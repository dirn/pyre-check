(window.webpackJsonp=window.webpackJsonp||[]).push([[17],{74:function(e,n,t){"use strict";t.r(n),t.d(n,"frontMatter",(function(){return s})),t.d(n,"metadata",(function(){return o})),t.d(n,"rightToc",(function(){return l})),t.d(n,"default",(function(){return d}));var a=t(2),r=t(6),i=(t(0),t(81)),s={id:"pysa-advanced",title:"Advanced Topics",sidebar_label:"Advanced Topics"},o={unversionedId:"pysa-advanced",id:"pysa-advanced",isDocsHomePage:!1,title:"Advanced Topics",description:"This page documents less straightforward bits of Pysa.",source:"@site/docs/pysa_advanced.md",permalink:"/docs/pysa-advanced",sidebar_label:"Advanced Topics",sidebar:"documentation",previous:{title:"Feature Annotations",permalink:"/docs/pysa-features"},next:{title:"Dynamically Generating Models",permalink:"/docs/pysa-model-generators"}},l=[{value:"Annotating <code>dataclass</code> Models",id:"annotating-dataclass-models",children:[]},{value:"Tainting Specific <code>kwargs</code>",id:"tainting-specific-kwargs",children:[]},{value:"Combined Source Rules",id:"combined-source-rules",children:[]},{value:"Prevent Inferring Models with <code>SkipAnalysis</code>",id:"prevent-inferring-models-with-skipanalysis",children:[]},{value:"Ignoring overrides",id:"ignoring-overrides",children:[]}],c={rightToc:l};function d(e){var n=e.components,t=Object(r.a)(e,["components"]);return Object(i.b)("wrapper",Object(a.a)({},c,t,{components:n,mdxType:"MDXLayout"}),Object(i.b)("p",null,"This page documents less straightforward bits of Pysa."),Object(i.b)("h2",{id:"annotating-dataclass-models"},"Annotating ",Object(i.b)("inlineCode",{parentName:"h2"},"dataclass")," Models"),Object(i.b)("p",null,"In Pysa, ",Object(i.b)("a",Object(a.a)({parentName:"p"},{href:"https://docs.python.org/3/library/dataclasses.html?"}),Object(i.b)("inlineCode",{parentName:"a"},"dataclasses")),"\nare defined via attributes, which are converted to properties under the hood. If\nyou want to taint the attributes of a ",Object(i.b)("inlineCode",{parentName:"p"},"dataclass"),", you might try to do the\nfollowing:"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-python"}),'# tainted.py\n@dataclass(frozen=True)\nclass MyDataClass:\n    attribute: str = ""\n')),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-python"}),"# stubs/taint/tainted.py.pysa\n# This won't work\ntainted.MyDataClass.attribute: TaintSource[SensitiveData]\n")),Object(i.b)("p",null,"This doesn't work, because during analysis Pysa's understanding of the data\nclass is of how the class looks after the property is expanded; that is:"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-python"}),"# Pysa's view of tainted.py\nclass MyDataClass:\n  @property\n  def attribute(self) -> str: ...\n  @attribute.setter\n  def attribute(self, value) -> None: ...\n")),Object(i.b)("p",null,"Therefore, to annotate a ",Object(i.b)("inlineCode",{parentName:"p"},"dataclass")," attribute, you can use the ",Object(i.b)("inlineCode",{parentName:"p"},"@property"),"\nannotations:"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-python"}),"# stubs/taint/tainted.py.pysa\n@property\ndef tainted.MyDataClass.attribute(self) -> TaintSource[SensitiveData]: ...\n")),Object(i.b)("h2",{id:"tainting-specific-kwargs"},"Tainting Specific ",Object(i.b)("inlineCode",{parentName:"h2"},"kwargs")),Object(i.b)("p",null,"Sometimes, a function can have potential sinks mixed together with benign\nparameters in the keyword arguments (",Object(i.b)("inlineCode",{parentName:"p"},"kwargs"),") that it accepts. In these cases,\ntainting the whole ",Object(i.b)("inlineCode",{parentName:"p"},"kwargs")," variable will result in false positives when tainted\ndata flows into a benign ",Object(i.b)("inlineCode",{parentName:"p"},"kwarg"),". Instead, for a function like this:"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-python"}),'def eval_and_log(**kwargs):\n    eval(kwargs["eval"])\n    logging.debug(kwargs["log"])\n')),Object(i.b)("p",null,"We can lie a bit in our ",Object(i.b)("inlineCode",{parentName:"p"},".pysa")," file, and break out the dangerous argument for\ntainting:"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-python"}),"def eval_and_log(*, eval: TaintSink[RemoteCodeExecution], **kwargs): ...\n")),Object(i.b)("p",null,"This allows us to catch flows only into the ",Object(i.b)("inlineCode",{parentName:"p"},"eval")," keyword argument."),Object(i.b)("h2",{id:"combined-source-rules"},"Combined Source Rules"),Object(i.b)("p",null,"Some security vulnerabilities are better modeled as ",Object(i.b)("em",{parentName:"p"},"multiple")," sources reaching\na sink. For example, leaking credentials via ",Object(i.b)("inlineCode",{parentName:"p"},"requests.get")," could be modeled as\nuser controlled data flowing into the ",Object(i.b)("inlineCode",{parentName:"p"},"url")," parameter and credentials flowing\ninto the ",Object(i.b)("inlineCode",{parentName:"p"},"params")," parameter. These flows can be modeled by ",Object(i.b)("em",{parentName:"p"},"combined source\nrules"),"."),Object(i.b)("p",null,"Sources for combined source rules are declared as normal in ",Object(i.b)("inlineCode",{parentName:"p"},"taint.config"),".\nSinks, however, have to include a ",Object(i.b)("inlineCode",{parentName:"p"},"multi_sink_labels")," entry which declares\nlabels that will correspond to each source. The rule itself is declared in the\n",Object(i.b)("inlineCode",{parentName:"p"},"combined_source_rules")," top level entry. The rule lists all the same things as a\nreglular rule, but also ties the labels from ",Object(i.b)("inlineCode",{parentName:"p"},"multi_sink_labels")," to each source:"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-json"}),'{\n  "sources": [\n    { "name": "UserControlled" },\n    { "name": "Credentials" }\n  ],\n  "sinks": [\n    { "name": "UserControlledRequestWithCreds", "multi_sink_labels": ["url", "creds"] }\n  ],\n  "combined_source_rules": [\n    {\n       "name": "Credentials leaked through requests",\n       "sources": { "url": "UserControlled", "creds": "Credentials" },\n       "sinks": ["UserControlledRequestWithCreds"],\n       "code": 1,\n       "message_format": "Credentials leaked through requests"\n    }\n  ]\n}\n')),Object(i.b)("p",null,"Sources are declared as normal in ",Object(i.b)("inlineCode",{parentName:"p"},".pysa")," files. Instead of specifying sinks\nwith a ",Object(i.b)("inlineCode",{parentName:"p"},"TaintSink")," annotation, however, ",Object(i.b)("inlineCode",{parentName:"p"},"PartialSink")," annotations are used to\nspecify where each source needs to flow for the combined source rule. These\n",Object(i.b)("inlineCode",{parentName:"p"},"PartialSink")," must reference the labels that were declared in\n",Object(i.b)("inlineCode",{parentName:"p"},"multi_sink_labels"),":"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-python"}),"def requests.api.get(\n  url: PartialSink[UserControlledRequestWithCreds[url]],\n  params: PartialSink[UserControlledRequestWithCreds[creds]] = ...,\n  **kwargs\n): ...\n")),Object(i.b)("p",null,"With the above configuration, Pysa can detect cases where ",Object(i.b)("inlineCode",{parentName:"p"},"UserControlled")," flows\ninto ",Object(i.b)("inlineCode",{parentName:"p"},"url")," and ",Object(i.b)("inlineCode",{parentName:"p"},"Credentials")," flow into ",Object(i.b)("inlineCode",{parentName:"p"},"params")," ",Object(i.b)("em",{parentName:"p"},"at the same time"),"."),Object(i.b)("h2",{id:"prevent-inferring-models-with-skipanalysis"},"Prevent Inferring Models with ",Object(i.b)("inlineCode",{parentName:"h2"},"SkipAnalysis")),Object(i.b)("p",null,"In addition to the models defined in ",Object(i.b)("inlineCode",{parentName:"p"},".pysa")," files, Pysa will infer models for\nfunctions based what sources, sinks, etc. they call in their body. The\n",Object(i.b)("inlineCode",{parentName:"p"},"SkipAnalysis")," annotation can be used to prevent Pysa from inferring models, and\ninstead force it to use only the user defined models for determining taint flow:"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-python"}),"def qualifier.dont_generate_models(argument) -> SkipAnalysis: ...\n")),Object(i.b)("p",null,Object(i.b)("inlineCode",{parentName:"p"},"SkipAnalysis")," can be applied at the class level as a shorthand to prevent pysa\nfrom infering models for all functions in a class:"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-python"}),"class skip_analysis.SkipMe(SkipAnalysis): ...\n")),Object(i.b)("h2",{id:"ignoring-overrides"},"Ignoring overrides"),Object(i.b)("p",null,"When a method is called on a base class, Pysa has to assume that that call could\nactually invoke any subclass methods that override the base class's method. For\nheavily overriden methods, this can lead to both performance impacts and false\npositives. When running Pysa, you may see messages such as this in the output:"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{}),"2020-09-02 09:25:50,677 WARNING `object.__init__` has 106 overrides, this might slow down the analysis considerably.\n")),Object(i.b)("p",null,"The above message indicates that 106 subclasses of ",Object(i.b)("inlineCode",{parentName:"p"},"object")," have overridden\n",Object(i.b)("inlineCode",{parentName:"p"},"__init__"),". If Pysa sees taint flowing into ",Object(i.b)("inlineCode",{parentName:"p"},"object.__init__"),", then it will\ntreat all 106 overrides of ",Object(i.b)("inlineCode",{parentName:"p"},"object.__init__")," as also receiving that taint."),Object(i.b)("p",null,"The ",Object(i.b)("inlineCode",{parentName:"p"},"SkipOverrides")," annotation can be applied to deal with false positives or\nperformance issues from having too many overrides on a given function:"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-python"}),"def object.__init__(self) -> SkipOverrides: ...\n")),Object(i.b)("p",null,"This annotation will cause Pysa not to propagate taint into to and from\noverridden methods on subclasses, when analyzing functions that call the\noverriden method on the base class."),Object(i.b)("p",null,Object(i.b)("inlineCode",{parentName:"p"},"maximum_overrides_to_analyze")," can be added the the ",Object(i.b)("inlineCode",{parentName:"p"},"options")," block of\n",Object(i.b)("inlineCode",{parentName:"p"},"taint.config")," to limit the number of overrides that Pysa will analyze:"),Object(i.b)("pre",null,Object(i.b)("code",Object(a.a)({parentName:"pre"},{className:"language-json"}),'{\n  "sources": [],\n  "sinks": [],\n  "features": [],\n  "rules": [],\n  "options": {\n    "maximum_overrides_to_analyze": 60\n  }\n}\n')),Object(i.b)("p",null,"This can speed up the analysis, but it will lead to false positives, because\nPysa will only propagate taint to or from 60 (in the case of the above example)\noverriden methods on subclasses. The remaining overriding methods will be\nignored and treated as if they weren't actually overriding the base class\nmethod."),Object(i.b)("p",null,"By default, Pysa skips overrides on some functions that are typically\nproblematic. You can find the full list of default-skipped functions in\n",Object(i.b)("a",Object(a.a)({parentName:"p"},{href:"https://github.com/facebook/pyre-check/blob/master/stubs/taint/skipped_overrides.pysa"}),Object(i.b)("inlineCode",{parentName:"a"},"stubs/taint/skipped_overrides.pysa"))))}d.isMDXComponent=!0},81:function(e,n,t){"use strict";t.d(n,"a",(function(){return b})),t.d(n,"b",(function(){return m}));var a=t(0),r=t.n(a);function i(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function s(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);n&&(a=a.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,a)}return t}function o(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?s(Object(t),!0).forEach((function(n){i(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):s(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function l(e,n){if(null==e)return{};var t,a,r=function(e,n){if(null==e)return{};var t,a,r={},i=Object.keys(e);for(a=0;a<i.length;a++)t=i[a],n.indexOf(t)>=0||(r[t]=e[t]);return r}(e,n);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(a=0;a<i.length;a++)t=i[a],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(r[t]=e[t])}return r}var c=r.a.createContext({}),d=function(e){var n=r.a.useContext(c),t=n;return e&&(t="function"==typeof e?e(n):o(o({},n),e)),t},b=function(e){var n=d(e.components);return r.a.createElement(c.Provider,{value:n},e.children)},p={inlineCode:"code",wrapper:function(e){var n=e.children;return r.a.createElement(r.a.Fragment,{},n)}},u=r.a.forwardRef((function(e,n){var t=e.components,a=e.mdxType,i=e.originalType,s=e.parentName,c=l(e,["components","mdxType","originalType","parentName"]),b=d(t),u=a,m=b["".concat(s,".").concat(u)]||b[u]||p[u]||i;return t?r.a.createElement(m,o(o({ref:n},c),{},{components:t})):r.a.createElement(m,o({ref:n},c))}));function m(e,n){var t=arguments,a=n&&n.mdxType;if("string"==typeof e||a){var i=t.length,s=new Array(i);s[0]=u;var o={};for(var l in n)hasOwnProperty.call(n,l)&&(o[l]=n[l]);o.originalType=e,o.mdxType="string"==typeof e?e:a,s[1]=o;for(var c=2;c<i;c++)s[c]=t[c];return r.a.createElement.apply(null,s)}return r.a.createElement.apply(null,t)}u.displayName="MDXCreateElement"}}]);