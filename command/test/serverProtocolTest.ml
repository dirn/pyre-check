(*
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *)

open Core
open OUnit2
open Server
open Protocol
open Test

let test_type_query_json _ =
  let open TypeQuery in
  let assert_serializes response json =
    assert_equal
      ~printer:Yojson.Safe.to_string
      (response_to_yojson response)
      (Yojson.Safe.from_string json)
  in
  assert_serializes (Error "message") {|{"error": "message"}|};
  assert_serializes
    (Response
       (FoundAttributes
          [{ name = "name"; annotation = Analysis.Type.integer; kind = Regular; final = true }]))
    {|{"response": {"attributes": [{"name": "name", "annotation": "int", "kind": "regular", "final": true}]}}|};
  assert_serializes
    (Response
       (FoundAttributes
          [{ name = "name"; annotation = Analysis.Type.integer; kind = Property; final = false }]))
    {|{"response": {"attributes": [{"name": "name", "annotation": "int", "kind": "property", "final": false}]}}|};
  assert_serializes
    (Response
       (FoundMethods
          [
            {
              name = "method";
              parameters = [Analysis.Type.integer];
              return_annotation = Analysis.Type.string;
            };
          ]))
    {|
      {
       "response": {
         "methods": [
           {
             "name": "method",
             "parameters": ["int"],
             "return_annotation": "str"
           }
         ]
       }
      }
    |};
  assert_serializes (Response (Type Analysis.Type.integer)) {|{"response": {"type": "int"}}|};
  assert_serializes
    (Response
       (Superclasses
          [
            {
              Protocol.TypeQuery.class_name = !&"test.C";
              superclasses = [Analysis.Type.integer; Analysis.Type.string];
            };
          ]))
    {|{"response": {"superclasses": ["int", "str"]}}|};
  assert_serializes
    (Response
       (Superclasses
          [
            {
              Protocol.TypeQuery.class_name = !&"test.C";
              superclasses = [Analysis.Type.integer; Analysis.Type.string];
            };
            {
              Protocol.TypeQuery.class_name = !&"test.D";
              superclasses = [Analysis.Type.integer; Analysis.Type.bool];
            };
          ]))
    {|
      {
        "response": [
          {
            "class_name":"test.C",
            "superclasses":["int","str"]
          },
          {
            "class_name":"test.D",
            "superclasses":["int","bool"]
          }
        ]
      }
    |};
  assert_serializes
    (Response
       (Batch
          [
            Response (Type Analysis.Type.integer);
            Response (Type Analysis.Type.string);
            Error "message";
          ]))
    {|{"response":[{"response":{"type":"int"}},{"response":{"type":"str"}},{"error":"message"}]}|}


let () = "serverProtocol" >::: ["type_query_json" >:: test_type_query_json] |> Test.run
