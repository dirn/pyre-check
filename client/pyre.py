# Copyright (c) Facebook, Inc. and its affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.


import argparse
import logging
import os
import shutil
import sys
import time
import traceback
from dataclasses import dataclass, replace
from pathlib import Path
from typing import List, Optional

from . import (
    analysis_directory,
    buck,
    command_arguments,
    commands,
    configuration as configuration_module,
    log,
    recently_used_configurations,
    statistics,
)
from .commands import Command, ExitCode, IncrementalStyle
from .exceptions import EnvironmentException
from .version import __version__


LOG: logging.Logger = logging.getLogger(__name__)


@dataclass
class FailedOutsideLocalConfigurationException(Exception):
    exit_code: ExitCode
    command: Command
    exception_message: str


def _set_default_command(arguments: argparse.Namespace) -> None:
    if shutil.which("watchman"):
        arguments.command = commands.Incremental.from_arguments
        arguments.nonblocking = False
        arguments.incremental_style = IncrementalStyle.FINE_GRAINED
        arguments.no_start = False
    else:
        watchman_link = "https://facebook.github.io/watchman/docs/install"
        LOG.warning(
            "No watchman binary found. \n"
            "To enable pyre incremental, "
            "you can install watchman: {}".format(watchman_link)
        )
        LOG.warning("Defaulting to non-incremental check.")
        arguments.command = commands.Check.from_arguments


def _log_statistics(
    command: Command,
    start_time: float,
    client_exception_message: str,
    error_message: Optional[str],
    exit_code: int,
    should_log: bool = True,
) -> None:
    configuration = command.configuration
    if should_log and configuration and configuration.logger:
        statistics.log_with_configuration(
            category=statistics.LoggerCategory.USAGE,
            configuration=configuration,
            integers={
                "exit_code": exit_code,
                "runtime": int((time.time() - start_time) * 1000),
            },
            normals={
                "root": configuration.local_root,
                "cwd": os.getcwd(),
                "client_version": __version__,
                "command": command.NAME,
                "client_exception": client_exception_message,
                "error_message": error_message,
            },
        )


def _show_pyre_version(arguments: command_arguments.CommandArguments) -> None:
    try:
        configuration = configuration_module.create_configuration(arguments, Path("."))
        binary_version = configuration.get_binary_version()
        if binary_version:
            log.stdout.write(f"Binary version: {binary_version}\n")
    except Exception:
        pass
    log.stdout.write(f"Client version: {__version__}\n")


def run_pyre_command(
    command: Command,
    configuration: configuration_module.Configuration,
    noninteractive: bool,
) -> ExitCode:
    start_time = time.time()

    client_exception_message = ""
    should_log_statistics = True
    # Having this as a fails-by-default helps flag unexpected exit
    # from exception flows.
    exit_code = ExitCode.FAILURE
    try:
        configuration_module.check_nested_local_configuration(configuration)
        log.start_logging_to_directory(noninteractive, configuration.log_directory)
        exit_code = command.run().exit_code()
    except analysis_directory.NotWithinLocalConfigurationException as error:
        should_log_statistics = False
        raise FailedOutsideLocalConfigurationException(exit_code, command, str(error))
    except (buck.BuckException, EnvironmentException) as error:
        client_exception_message = str(error)
        exit_code = ExitCode.FAILURE
        if isinstance(error, buck.BuckException):
            exit_code = ExitCode.BUCK_ERROR
    except commands.ClientException as error:
        client_exception_message = str(error)
        exit_code = ExitCode.FAILURE
    except Exception:
        client_exception_message = traceback.format_exc()
        exit_code = ExitCode.FAILURE
    except KeyboardInterrupt:
        LOG.warning("Interrupted by user")
        LOG.debug(traceback.format_exc())
        exit_code = ExitCode.SUCCESS
    finally:
        if len(client_exception_message) > 0:
            LOG.error(client_exception_message)
        result = command.result()
        error_message = result.error if result else None
        command.cleanup()
        _log_statistics(
            command,
            start_time,
            client_exception_message,
            error_message,
            exit_code,
            should_log_statistics,
        )
    return exit_code


def _create_configuration_with_retry(
    arguments: command_arguments.CommandArguments, base_directory: Path
) -> configuration_module.Configuration:
    configuration = configuration_module.create_configuration(arguments, base_directory)
    if len(configuration.source_directories) > 0 or len(configuration.targets) > 0:
        return configuration

    # Heuristic: If neither `source_directories` nor `targets` is specified,
    # and if there exists recently-used local configurations, we guess that
    # the user may have forgotten to specifiy `-l`.
    error_message = "No buck targets or source directories to analyze."
    recently_used_local_roots = recently_used_configurations.Cache(
        configuration.dot_pyre_directory
    ).get_all_items()
    if len(recently_used_local_roots) == 0:
        raise configuration_module.InvalidConfiguration(error_message)

    LOG.warning(error_message)
    local_root_for_rerun = recently_used_configurations.prompt_user_for_local_root(
        recently_used_local_roots
    )
    if local_root_for_rerun is None:
        raise configuration_module.InvalidConfiguration(
            "Cannot determine which recent local root to rerun. "
        )

    LOG.warning(f"Restarting pyre under local root `{local_root_for_rerun}`...")
    LOG.warning(
        f"Hint: To avoid this prompt, run `pyre -l {local_root_for_rerun}` "
        f"or `cd {local_root_for_rerun} && pyre`."
    )
    new_configuration = configuration_module.create_configuration(
        replace(arguments, local_configuration=local_root_for_rerun), base_directory
    )
    if (
        len(new_configuration.source_directories) > 0
        or len(new_configuration.targets) > 0
    ):
        return new_configuration
    raise configuration_module.InvalidConfiguration(error_message)


def _run_pyre_with_retry(arguments: argparse.Namespace) -> ExitCode:
    try:
        configuration = configuration_module.create_configuration(
            command_arguments.CommandArguments.from_arguments(arguments), Path(".")
        )
        command = arguments.command(arguments, os.getcwd(), configuration)
        return run_pyre_command(command, configuration, arguments.noninteractive)
    except configuration_module.InvalidConfiguration as error:
        LOG.error(str(error))
        return ExitCode.CONFIGURATION_ERROR
    except FailedOutsideLocalConfigurationException as exception:
        command = exception.command
        exit_code = exception.exit_code
        client_exception_message = exception.exception_message

    configurations = recently_used_configurations.Cache(
        command.configuration.dot_pyre_directory
    ).get_all_items()
    if not configurations:
        LOG.error(client_exception_message)
        return exit_code

    LOG.warning(
        f"Could not find a Pyre local configuration at `{command._original_directory}`."
    )
    local_root_for_rerun = recently_used_configurations.prompt_user_for_local_root(
        configurations
    )
    if not local_root_for_rerun:
        return exit_code

    arguments.local_configuration = local_root_for_rerun
    LOG.warning(
        f"Rerunning the command in recent local configuration `{local_root_for_rerun}`."
    )
    LOG.warning(
        f"Hint: To avoid this prompt, run `pyre -l {local_root_for_rerun}` "
        f"or `cd {local_root_for_rerun} && pyre`."
    )
    try:
        configuration = configuration_module.create_configuration(
            command_arguments.CommandArguments.from_arguments(arguments), Path(".")
        )
        command = arguments.command(arguments, os.getcwd(), configuration)
        return run_pyre_command(command, configuration, arguments.noninteractive)
    except configuration_module.InvalidConfiguration as error:
        LOG.error(str(error))
        return ExitCode.CONFIGURATION_ERROR
    except FailedOutsideLocalConfigurationException:
        LOG.error(f"Failed to rerun command in `{local_root_for_rerun}`.")
        return ExitCode.FAILURE


# Need the default argument here since this is our entry point in setup.py
def main(argv: List[str] = sys.argv[1:]) -> int:
    parser = argparse.ArgumentParser(
        allow_abbrev=False,
        formatter_class=argparse.RawTextHelpFormatter,
        epilog="environment variables:"
        "\n   `PYRE_BINARY` overrides the pyre binary used."
        "\n   `PYRE_VERSION_HASH` overrides the pyre version set in the "
        "configuration files.",
    )
    commands.Command.add_arguments(parser)

    # Subcommands.
    subcommand_names = ", ".join(
        [command.NAME for command in commands.COMMANDS if not command.HIDDEN]
    )
    parsed_commands = parser.add_subparsers(
        metavar="{}".format(subcommand_names),
        help="""
        The pyre command to run; defaults to `incremental`.
        Run `pyre command --help` for documentation on a specific command.
        """,
    )

    for command in commands.COMMANDS:
        command.add_subparser(parsed_commands)

    arguments = parser.parse_args(argv)

    if arguments.version:
        _show_pyre_version(command_arguments.CommandArguments.from_arguments(arguments))
        return ExitCode.SUCCESS

    with log.configured_logger(arguments.noninteractive):
        if not hasattr(arguments, "command"):
            _set_default_command(arguments)

        # Special-case `pyre init` because it is not a `Command` like the others.
        if arguments.command == commands.Initialize.from_arguments:
            exit_code = arguments.command().run().exit_code()
            return exit_code
        return _run_pyre_with_retry(arguments)


if __name__ == "__main__":
    try:
        os.getcwd()
    except FileNotFoundError:
        LOG.error(
            "Pyre could not determine the current working directory. "
            "Has it been removed?\nExiting."
        )
        sys.exit(ExitCode.FAILURE)
    sys.exit(main(sys.argv[1:]))
