/*
 * jassa-ui-angular-edit
 * https://github.com/GeoKnow/Jassa-UI-Angular

 * Version: 0.1.0 - 2014-12-05
 * License: BSD
 */
function capitalize(a){return a&&a[0].toUpperCase()+a.slice(1)}angular.module("ui.jassa.edit",["ui.jassa.rdf-term-input","ui.jassa.rex","ui.jassa.sync"]),angular.module("ui.jassa.rdf-term-input",[]).directive("rdfTermInput",["$parse",function(){var a={iri:"http://iri",plainLiteral:"http://plainLiteral",typedLiteral:"http://typedLiteral"};return{restrict:"EA",priority:4,require:"^ngModel",templateUrl:"template/rdf-term-input/rdf-term-input.html",replace:!0,scope:{bindModel:"=ngModel",ngModelOptions:"=?",logo:"@?",langs:"=?",datatypes:"=?"},controller:["$scope",function(b){b.state=b.$state||{},b.ngModelOptions=b.ngModelOptions||{},b.vocab=a,b.termTypes=[{id:a.iri,displayLabel:"IRI"},{id:a.plainLiteral,displayLabel:"plain"},{id:a.typedLiteral,displayLabel:"typed"}];var c=[{id:"",displayLabel:"(none)"},{id:"en",displayLabel:"en"},{id:"de",displayLabel:"de"},{id:"fr",displayLabel:"fr"},{id:"zh",displayLabel:"zh"},{id:"ja",displayLabel:"ja"}];b.langs=b.langs||c;var d=Object.keys(jassa.vocab.xsd);b.datatypes=d.map(function(a){var b=jassa.vocab.xsd[a].getUri();return{id:b,displayLabel:jassa.util.UriUtils.extractLabel(b)}})}],compile:function(){return{pre:function(b){var c=function(){var c,d=b.state,e=d.type;switch(e){case a.iri:c={type:"uri",value:d.value};break;case a.plainLiteral:c={type:"literal",value:d.value,lang:d.lang,datatype:""};break;case a.typedLiteral:c={type:"literal",value:d.value,datatype:d.datatype||jassa.vocab.xsd.xstring.getUri()}}return c},d=function(b){var c=b;null!=c.type&&null==c.value&&(c.value="");var d;try{d=jassa.rdf.NodeFactory.createFromTalisRdfJson(c)}catch(e){}var f;if(d){if(d.isUri())f={type:a.iri,value:d.getUri()};else if(d.isLiteral()){var g=d.getLiteralDatatypeUri(),h=!jassa.util.ObjectUtils.isEmptyString(g);f=h?{type:a.typedLiteral,value:d.getLiteralLexicalForm(),datatype:g}:{type:a.plainLiteral,value:d.getLiteralLexicalForm(),lang:d.getLiteralLanguage()}}}else f={};return f};b.$watch(function(){var a=b.bindModel;return a},function(a){if(a){var c=d(a);b.state=c}},!0),b.$watch(function(){var a=c();return a},function(a){a&&angular.copy(a,b.bindModel)},!0)}}}}}]);var RexContext=jassa.ext.Class.create({initialize:function(a){this.lookupService=a,this.sourceGraph=new jassa.rdf.GraphImpl,this.cache=new jassa.util.HashMap,this.override=new jassa.util.HashMap,this.json={}},prefetch:function(a){this.cache.containsKey(a);var b=this,c=this.lookupService.lookup([a]).then(function(a){console.log("Successfully prefetched: ",a);var c=a.entries();c.forEach(function(a){var c=a.val.data;b.cache.putMap(c);var d=assembleTalisRdfJson(c);_(b.json).extend(d)})});return c},combinedMap:function(){var a=[this.override,this.cache].filter(function(a){return null!=a}),b=new jassa.util.MapUnion(a);return b},getValue:function(a){var b=this.combinedMap(),c=b.get(a);return c},asTalisJsonRdf:function(){var a=this.combinedMap(),b=assembleTalisRdfJson(a);return b}}),parsePrefixStr=function(){regex=/\s*([^:]+)\s*:\s*([^\s]+)\s*/g},parsePrefixes=function(a){var b=a?a instanceof PrefixMappingImpl?a:new PrefixMappingImpl(a):new PrefixMappingImpl;return b},getModelAttribute=function(a){var b=["ngModel","model"],c=Object.keys(a),d=null;return b.some(function(a){var b=c.indexOf(a)>=0;return b&&(d=a),b}),d},createCompileComponent=function(a,b,c){return{pre:function(d,e,f,g){var h=f[a],i=c(h),j=i.assign,k=(syncAttr(c,d,f,a),g[0]),l=(g[1],k.allocSlot());l.entry={},d.$on("$destroy",function(){l.release()}),d.$watch(function(){var a=createCoordinate(d,b);return a},function(a,b){l.entry.key=a;var c=d.rexContext.getValue(b);if(c){var e={key:a,val:c};k.getOverride().putEntries([e])}},!0),d.$watch(function(){var a=l.entry.key,b=d.rexContext.getValue(a);return b},function(a){var b=l.entry.key,c={key:b,val:a};null!=a&&k.getOverride().putEntries([c]),l.entry.value=a,j&&null!=a&&j(d,a)},!0),d.$watch(function(){var a=i(d);return a},function(a){var b=l.entry.key,c={key:b,val:a};l.entry.val=a,null!=a&&k.getOverride().putEntries([c])},!0)}}},assembleTalisRdfJson=function(a){var b={},c=a.entries();return c.forEach(function(a){var c=a.key,d=a.val,e=b,f=e[c.s]=e[c.s]||{},g=f[c.p]=f[c.p]||[],h=g[c.i]=g[c.i]||{};h[c.c]=d}),b},__defaultPrefixMapping=new jassa.rdf.PrefixMappingImpl(jassa.vocab.InitialContext),createCoordinate=function(a,b){var c=a.rexPrefixMapping||__defaultPrefixMapping;return{s:c.expandPrefix(a.rexSubject),p:c.expandPrefix(a.rexPredicate),i:a.rexObject,c:b}},syncAttr=function(a,b,c,d,e,f){var g=c[d],h=a(g),i=function(a){var c=f?f(a):a;b[d]=c};b.$watch(function(){var a=h(b);return a},function(a){i(a)},e);var j=h(b);return i(j),j};angular.module("ui.jassa.rex",[]);var basePriority=0;angular.module("ui.jassa.rex").directive("rexContext",["$parse",function(a){return{priority:basePriority+20,restrict:"A",scope:!0,require:"rexContext",controller:["$scope",function(a){this.getOverride=function(){return a.rexContext.override},this.nextSlot=0,a.rexChangeSlots={},this.allocSlot=function(){var b=this.nextSlot++,c=""+b,d=a.rexChangeSlots[c]={id:c,release:function(){delete a.rexChangeSlots[c]}};return d},this.getReferencedCoordinates=function(){var b=a.rexChangeSlots,c=Object.keys(b),d=c.map(function(a){var c=b[a],d=c.entry;return d?d.key:null});return d=d.filter(function(a){return null!=a})}}],compile:function(){return{pre:function(b,c,d,e){syncAttr(a,b,d,"rexContext");var f=function(a,b){var c=a.entries();c.forEach(function(c){var d=c.key,e=c.val,f=b.get(d);jassa.util.ObjectUtils.isEqual(e,f)&&a.remove(d)})},g=function(a){a=a||e.getReferencedCoordinates();var c=(b.rexContext.override,new jassa.util.HashMap,new jassa.util.HashMap);return a.forEach(function(a){var d=b.rexContext.getValue(a);c.put(a,d)}),c},h=function(a){{var c=assembleTalisRdfJson(a),d=jassa.io.TalisRdfJsonUtils.talisRdfJsonToTurtle(c),e=assembleTalisRdfJson(b.rexContext.cache),f=jassa.io.TalisRdfJsonUtils.talisRdfJsonToTriples(e).map(function(a){return""+a}),g=jassa.io.TalisRdfJsonUtils.talisRdfJsonToTriples(c).map(function(a){return""+a});_(f).difference(g),_(g).difference(f)}b.rexContext.talisJson=d},i=function(){var a=b.rexContext.override;f(a,b.rexContext.cache);var c=a.entries();c.forEach(function(b){null==b.val&&a.remove(b.key)})},j=function(a){a=a||e.getReferencedCoordinates();var c=jassa.util.SetUtils.arrayToSet(a);jassa.util.MapUtils.retainKeys(b.rexContext.override,c)};b.$watch(function(){return e.getReferencedCoordinates()},function(a){j(a),i()},!0),b.$watch(function(){var a=e.getReferencedCoordinates(),b=g(a);return b},function(a){h(a)},!0)}}}}}]),angular.module("ui.jassa.rex").directive("rexDatatype",["$parse",function(a){return{priority:7,restrict:"A",scope:!0,require:["^rexContext","^rexObject"],controller:function(){},compile:function(){return createCompileComponent("rexDatatype","datatype",a)}}}]),angular.module("ui.jassa.rex").directive("rexDeleted",["$parse",function(a){return{priority:379,restrict:"A",scope:!0,require:["^rexContext","^rexObject"],controller:function(){},compile:function(){return createCompileComponent("rexDeleted","deleted",a)}}}]),angular.module("ui.jassa.rex").directive("rexIri",["$parse","$compile",function(a,b){return{priority:basePriority+1e3,restrict:"A",scope:!0,terminal:!0,controller:function(){},compile:function(){return{pre:function(a,c,d){var e=c.attr("rex-iri");if(jassa.util.ObjectUtils.isEmptyString(e)){var f=getModelAttribute(d);e=d[f]}if(!e)throw new Error("No model provided and found");c.removeAttr("rex-iri"),c.attr("rex-object",""),c.attr("rex-termtype",'"uri"'),c.attr("rex-value",e),b(c)(a)},post:function(){}}}}}]),angular.module("ui.jassa.rex").directive("rexLang",["$parse",function(a){return{priority:7,restrict:"A",scope:!0,require:["^rexContext","^rexObject"],controller:function(){},compile:function(){return createCompileComponent("rexLang","lang",a)}}}]),angular.module("ui.jassa.rex").directive("rexLiteral",["$parse","$compile",function(a,b){return{priority:basePriority+1e3,restrict:"A",scope:!0,terminal:!0,controller:function(){},compile:function(){return{pre:function(a,c,d){var e=c.attr("rex-literal");if(jassa.util.ObjectUtils.isEmptyString(e)){var f=getModelAttribute(d);e=d[f]}if(!e)throw new Error("No model provided and found");c.removeAttr("rex-literal"),c.attr("rex-object",""),c.attr("rex-termtype",'"literal"'),c.attr("rex-value",e),b(c)(a)},post:function(){}}}}}]),angular.module("ui.jassa.rex").directive("rexLookup",["$parse",function(a){return{priority:basePriority+19,restrict:"A",scope:!0,require:"?rexContext",controller:function(){},compile:function(){return{pre:function(b,c,d){syncAttr(a,b,d,"rexLookup")}}}}}]),angular.module("ui.jassa.rex").directive("rexObject",["$parse",function(a){return{priority:basePriority+13,restrict:"A",scope:!0,require:"^rexPredicate",controller:function(){},compile:function(){return{pre:function(b,c,d,e){var f=e.rexObjectScopes.length;d.rexObject||(d.rexObject=""+f),e.rexObjectScopes.push(b),syncAttr(a,b,d,"rexObject"),b.$on("$destroy",function(){jassa.util.ArrayUtils.removeItemStrict(e.rexObjectScopes,b)})}}}}}]),angular.module("ui.jassa.rex").directive("rexPredicate",["$parse",function(a){return{priority:basePriority+17,restrict:"A",scope:!0,controller:["$scope",function(a){this.rexObjectScopes=a.rexObjectScopes=[]}],compile:function(){return{pre:function(b,c,d){syncAttr(a,b,d,"rexPredicate")}}}}}]),angular.module("ui.jassa.rex").directive("rexPrefix",["$parse",function(a){return{priority:basePriority+19,restrict:"A",scope:!0,controller:function(){},compile:function(){return{pre:function(b,c,d){var e=function(a){var c,d=b.$parent.rexPrefix,e=d?d.prefixes:jassa.vocab.InitialContext;c=e?Object.create(e):{};var f=jassa.util.PrefixUtils.parsePrefixDecls(a);return angular.extend(c,f),c};syncAttr(a,b,d,"rexPrefix",!0,e);var f=function(){b.rexPrefixMapping=new jassa.rdf.PrefixMappingImpl(b.rexPrefix)};b.$watch(function(){return b.rexPrefix},function(){f()},!0),f()}}}}}]),angular.module("ui.jassa.rex").directive("rexSubject",["$parse","$q",function(a,b){return{priority:basePriority+18,restrict:"A",scope:!0,require:"^rexContext",controller:function(){},compile:function(){return{pre:function(c,d,e){var f=(syncAttr(a,c,e,"rexSubject"),function(){var a=c.rexLookup,d=c.rexSubject;if(a&&jassa.util.ObjectUtils.isFunction(a)&&d){var e=c.rexPrefixMapping,f=e?e.expandPrefix(d):d,g=jassa.rdf.NodeFactory.createUri(f),h=c.rexLookup(g);b.when(h).then(function(a){context.sourceGraph.addAll(a)})}});c.$watch(function(){return c.rexLookup},function(){f()}),c.$watch(function(){return c.rexSubject},function(){f()}),c.$watch(function(){return c.rexPrefixMapping},function(){f()})}}}}}]),angular.module("ui.jassa.rex").directive("rexTermtype",["$parse",function(a){return{priority:7,restrict:"A",scope:!0,require:["^rexContext","^rexObject"],controller:function(){},compile:function(){return createCompileComponent("rexTermtype","type",a)}}}]),angular.module("ui.jassa.rex").directive("rexTypeof",["$parse","$compile",function(a,b){return{priority:basePriority+1e3,restrict:"A",scope:!0,terminal:!0,controller:function(){},compile:function(){return{pre:function(a,c){var d=c.attr("rex-typeof");c.removeAttr("rex-typeof"),c.attr("rex-predicate",'"http://www.w3.org/1999/02/22-rdf-syntax-ns#type"'),c.attr("rex-iri",d),b(c)(a)},post:function(){}}}}}]),angular.module("ui.jassa.rex").directive("rexValue",["$parse",function(a){return{priority:379,restrict:"A",scope:!0,require:["^rexContext","^rexObject"],controller:function(){},compile:function(){return createCompileComponent("rexValue","value",a)}}}]);var syncHelper=function(a,b,c,d,e,f,g,h,i){var j=b[e],k=i?d(j):c(j),l=b[f],m=c(l),n=m.assign,o=b[g],p=c(o),q=function(a){return a},r=b[h],s=c(r),t=function(){var b=s(a),c=angular.isUndefined(b)?!0:b;return c},u=function(){var b=t();if(b){var c=k(a),d=p(a)||q,e=d(c);n(a,e)}};a.$watch(function(){var a=t();return a},function(a){a&&u()}),a.$watch(function(){var b=p(a);return b},function(a){a&&u()}),a.$watch(function(){var b=k(a);return b},function(){u()},!0)};angular.module("ui.jassa.sync",[]),angular.module("ui.jassa.sync").directive("syncToSource",["$parse","$interpolate",function(a,b){return{priority:390,restrict:"A",controller:function(){},compile:function(){return{pre:function(c,d,e){syncHelper(c,e,a,b,"syncTarget","syncSource","syncToSource","syncToSourceCond",!1)}}}}}]),angular.module("ui.jassa.sync").directive("syncToTarget",["$parse","$interpolate",function(a,b){return{priority:390,restrict:"A",controller:function(){},compile:function(){return{pre:function(c,d,e){var f="syncSourceInterpolate"in e;syncHelper(c,e,a,b,"syncSource","syncTarget","syncToTarget","syncToTargetCond",f)}}}}}]);