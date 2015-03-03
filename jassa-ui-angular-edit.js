/*
 * jassa-ui-angular-edit
 * https://github.com/GeoKnow/Jassa-UI-Angular

 * Version: 0.9.0-SNAPSHOT - 2015-03-03
 * License: BSD
 */
angular.module("ui.jassa.edit", ["ui.jassa.geometry-input","ui.jassa.rdf-term-input","ui.jassa.rex","ui.jassa.sync"]);
angular.module('ui.jassa.geometry-input', [])

  .directive('geometryInput', ['$http', '$q', function($http, $q) {

    var uniqueId = 1;

    return {
      restrict: 'EA',
      priority: 4,
      require: ['^ngModel'],
      templateUrl: 'template/geometry-input/geometry-input.html',
      replace: true,
      scope: {
        bindModel: '=ngModel',
        ngModelOptions: '=?',
        geocodingServices: '=geocodingServices'
      },
      controller: ['$scope', function($scope) {
        $scope.ngModelOptions = $scope.ngModelOptions || {};
        $scope.geometry = 'point';
        $scope.isLoading = false;

        $scope.getGeocodingInformation = function(searchString, successCallback) {

          var url = 'http://nominatim.openstreetmap.org/search/?q='+searchString+'&format=json&polygon_text=1';

          var responsePromise = $http({
            'method': 'GET',
            'url': url,
            'cache': true,
            'headers' : {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });

          responsePromise.success(function(data, status, headers, config) {
            if(angular.isFunction(successCallback)) {
              successCallback(data, responsePromise);
            }

          });
          responsePromise.error(function(data, status, headers, config) {
            alert('AJAX failed!');
          });
        };

        var createSparqlService = function(url, graphUris) {
          var result = jassa.service.SparqlServiceBuilder.http(url, graphUris, {type: 'POST'})
            .cache().virtFix().paginate(1000).pageExpand(100).create();

          return result;
        };

        $scope.fetchResultsForRestService = function(restServiceConfig, searchString) {
          return $http({
            'method': 'GET',
            'url': restServiceConfig.endpoint+searchString,
            'cache': true,
            'headers' : {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
        };

        $scope.fetchResultsForSparqlService = function(sparqlServiceConfig, searchString) {

          var sparqlService = createSparqlService(sparqlServiceConfig.endpoint, sparqlServiceConfig.graph);

          var store = new jassa.sponate.StoreFacade(sparqlService, _(sparqlServiceConfig.prefix)
            .defaults(jassa.vocab.InitialContext));

          var query = sparqlServiceConfig.query.replace(/%SEARCHSTRING%/gi,searchString);

          store.addMap({
            name: 'sparqlService',
            template: [{
              id: '?s',
              label: '?l', // kann man dann noch besser machen - aber fürs erste passts
              wkt: '?g',
              group: '' + sparqlServiceConfig.name
            }],
            from: query
          });

          return store.sparqlService.getListService().fetchItems(null, 10);
        };

        $scope.fetchResults = function(searchString) {
          // Geocoding APIs
          var sources = {
            restService: [
              {
                name: 'Nominatim',
                endpoint: 'http://nominatim.openstreetmap.org/search/?format=json&polygon_text=1&q='
              },
              {
                name: 'Nokia HERE',
                endpoint: 'http://geocoder.cit.api.here.com/6.2/geocode.json?app_id=DemoAppId01082013GAL&app_code=AJKnXv84fjrb0KIHawS0Tg&additionaldata=IncludeShapeLevel,default&mode=retrieveAddresses&searchtext='
              }
            ],
            sparqlService: [
              {
                'name' : 'LinkedGeoData (Natural Earth)',
                'endpoint' : 'http://linkedgeodata.org/vsparql',
                'graph' : 'http://linkedgeodata.org/ne/',
                'type' : 'http://linkedgeodata.org/ne/ontology/Country',
                'active' : false,
                'facets' : false,
                'prefix' : {
                  ogc: 'http://www.opengis.net/ont/geosparql#',
                  geom: 'http://geovocab.org/geometry#'
                },
                'query' : '{'
                  +' Graph <http://linkedgeodata.org/ne/> {'
                  +' ?s a <http://linkedgeodata.org/ne/ontology/Country> ;'
                  +' rdfs:label ?l ;'
                  +' geom:geometry ['
                  +'  ogc:asWKT ?g'
                  +' ] '
                  +' FILTER regex(?l, "'+ searchString +'", "i") '
                  +' } '
                  +'}'
              }
            ]
          };

          // stores promises for each geocoding api
          var promiseCache = {
            promisesMetaInformation: {
              /**
               * [{
               *   name: x,
               *   promiseID: y
               * }]
               */
              restService: [],
              sparqlService: []
            },
            promises: []
          };
          for (var serviceType in $scope.geocodingServices) {
            if (serviceType === 'restService') {
              for(var r in sources.restService) {
                var restService = sources.restService[r];
                promiseCache.promisesMetaInformation.restService.push({
                  name: restService.name,
                  id: promiseCache.promises.length
                });
                promiseCache.promises.push($scope.fetchResultsForRestService(restService, searchString));
              }
            }

            if (serviceType === 'sparqlService') {
              for(var s in sources.sparqlService) {
                var sparqlService = sources.sparqlService[s];
                promiseCache.promisesMetaInformation.sparqlService.push({
                  name: sparqlService.name,
                  id: promiseCache.promises.length
                });
                promiseCache.promises.push($scope.fetchResultsForSparqlService(sparqlService, searchString));
              }
            }

          }

          // after getting the response then process the response promise
          var resultPromise = $q.all(promiseCache.promises).then(function(responses){

            console.log('promiseCache', promiseCache);

            var results = [];

            for (var i in responses) {
              // used to grab the hostname a.href = url -> a.hostname
              var a = document.createElement('a');

              for (var j in responses[i].data) {
                // Nominatim
                if(i==='0') {
                  a.href = responses[i].config.url;
                  if (responses[i].data[j].hasOwnProperty('geotext')) {
                    results.push({
                      'firstInGroup': false,
                      'wkt': responses[i].data[j].geotext,
                      'label': responses[i].data[j].display_name,
                      'group': $scope.geocodingServices.restService[i].name || a.hostname
                    });
                  }
                }

                // Nokia HERE Maps Sample
                if(i==='1') {
                  a.href = responses[i].config.url;
                  if (responses[i].data[j].View.length > 0) {
                    for(var k in responses[i].data[j].View[0].Result) {
                      if(responses[i].data[j].View[0].Result[k].Location.hasOwnProperty('Shape')) {
                        results.push({
                          'firstInGroup': false,
                          'wkt': responses[i].data[j].View[0].Result[k].Location.Shape.Value,
                          'label': responses[i].data[j].View[0].Result[k].Location.Address.Label,
                          'group': $scope.geocodingServices.restService[i].name || a.hostname
                        });
                      }
                    }
                  }
                }
              }

              // LinkedGeoData
              if(i==='2') {
                if (responses[i].length > 0) {
                  for(var l in responses[i]) {
                    results.push({
                      'firstInGroup': false,
                      'wkt': responses[i][l].val.wkt,
                      'label': responses[i][l].val.label,
                      'group': responses[i][l].val.group
                    });
                  }
                }
              }
            }

            // mark the first of each group for headlines
            results = _(results).groupBy('group');
            results = _(results).map(function(g) {
              g[0].firstInGroup = true;
              return g;
            });
            results = _(results).flatten();
            results = _(results).value();

            //console.log('results', results);

            return results;
          });

          return resultPromise;
        };

        $scope.onSelectGeocode = function(item) {
          console.log('onselect', item);
          $scope.bindModel = item.wkt;
        };
      }],
      compile: function(ele, attrs) {
        return {
          pre: function (scope, ele, attrs) {
            scope.searchString = '';

            var map, drawControls, polygonLayer, panel, wkt, vectors;

            scope.$watch(function () {
              return scope.bindModel;
            }, function (newValue, oldValue) {
              //console.log('old value of input', oldValue);
              // clear layer
              vectors.destroyFeatures();
              // set config data with changed input value ...
              scope.bindModel = newValue;
              // ... then call parseWKT to redraw the feature
              if (scope.bindModel != null) {
                parseWKT();
              }
            });

            scope.$watch(function () {
              return scope.geometry;
            }, function (newValue) {
              //console.log('radio', scope.geometry-input-input);
              //scope.geometry-input-input = newValue;
              toggleControl();
            });

            /** Disabled
            scope.$watch(function () {
              return scope.searchString;
            }, function (newValue) {
              console.log('searchString', newValue);
              if (newValue.length > 3) {
                scope.getGeocodingInformation(newValue, function(data) {
                  console.log('getGeocodingInformation', data);
                  for (var i in data) {
                    if(data[i].geotext != null) {
                      parseWKT(data[i].geotext);
                    }
                  }
                });
              }
              //scope.searchResults = scope.fetchGeocodingResults(newValue);
            });
            */

            function init() {
              // generate custom map id
              var mapId = 'openlayers-map-' + uniqueId++;
              // set custom map id
              ele.find('.map').attr('id', mapId);
              // init openlayers map with custom map id
              map = new OpenLayers.Map(mapId);

              var wmsLayer = new OpenLayers.Layer.WMS('OpenLayers WMS',
                'http://vmap0.tiles.osgeo.org/wms/vmap0?', {layers: 'basic'});

              panel = new OpenLayers.Control.Panel({'displayClass': 'olControlEditingToolbar'});

              var snapVertex = {methods: ['vertex', 'edge'], layers: [vectors]};

              // allow testing of specific renderers via "?renderer=Canvas", etc
              var renderer = OpenLayers.Util.getParameters(window.location.href).renderer;
              renderer = (renderer) ? [renderer] : OpenLayers.Layer.Vector.prototype.renderers;

              vectors = new OpenLayers.Layer.Vector('Vector Layer', {
                renderers: renderer
              });

              map.addLayers([wmsLayer, vectors]);
              map.addControl(new OpenLayers.Control.LayerSwitcher());
              map.addControl(new OpenLayers.Control.MousePosition());

              vectors.events.on({
                sketchcomplete: GeometryWasDrawn
              });

              wkt = new OpenLayers.Format.WKT();

              drawControls = {
                point: new OpenLayers.Control.DrawFeature(vectors,
                  OpenLayers.Handler.Point, {
                    displayClass: 'olControlDrawFeaturePoint',
                    handlerOptions: snapVertex}),
                line: new OpenLayers.Control.DrawFeature(vectors,
                  OpenLayers.Handler.Path, {
                    displayClass: 'olControlDrawFeaturePath',
                    handlerOptions: snapVertex}),
                polygon: new OpenLayers.Control.DrawFeature(vectors,
                  OpenLayers.Handler.Polygon, {
                    displayClass: 'olControlDrawFeaturePolygon',
                    handlerOptions: snapVertex}),
                box: new OpenLayers.Control.DrawFeature(vectors,
                  OpenLayers.Handler.RegularPolygon, {
                    displayClass: 'olControlDrawFeatureBox',
                    handlerOptions: _.extend({
                      sides: 4,
                      irregular: true
                    }, snapVertex)
                  }),
                modify: new OpenLayers.Control.ModifyFeature(vectors, {
                  snappingOptions: snapVertex,
                  onModificationStart: onModificationStart,
                  onModification: onModification,
                  onModificationEnd: onModificationEnd
                })
              };

              panel.addControls(drawControls['modify']);
              map.addControl(panel);
              panel.activateControl(drawControls.modify);

              for (var key in drawControls) {
                map.addControl(drawControls[key]);
              }

              map.setCenter(new OpenLayers.LonLat(0, 0), 4);
            }

            function GeometryWasDrawn(drawnGeometry) {
              /*var ft = polygonLayer.features;
              for(var i=0; i< ft.length; i++){
                console.log(polygonLayer.features[i].geometry-input-input.getBounds());
                displayWKT(polygonLayer.features[i]);
              }*/
              var wktValue = generateWKT(drawnGeometry.feature);
              scope.bindModel = wktValue;
              scope.$apply();
            }

            function generateWKT(feature) {
              var str = wkt.write(feature);
              str = str.replace(/,/g, ', ');
              return str;
            }

            function parseWKT(pWktString) {
              var wktString = pWktString || scope.bindModel;
              //console.log('parseWKT', scope.bindModel);
              var features = wkt.read(wktString);
              var bounds;
              if (features) {
                if (features.constructor != Array) {
                  features = [features];
                }
                for (var i = 0; i < features.length; ++i) {
                  if (!bounds) {
                    bounds = features[i].geometry.getBounds();
                  } else {
                    bounds.extend(features[i].geometry.getBounds());
                  }

                }
                vectors.addFeatures(features);
                map.zoomToExtent(bounds);
                var plural = (features.length > 1) ? 's' : '';
                //console.log('Added WKT-String. Feature' + plural + ' added');
              } else {
                console.log('Bad WKT');
              }
            }

            function toggleControl() {
              //console.log('toggleControl', scope.geometry-input-input);
              var control = drawControls[scope.geometry];
              for (var key in drawControls) {
                control = drawControls[key];
                if (scope.geometry == key) {
                  control.activate();
                } else {
                  control.deactivate();
                }
              }
            }

            function onModificationStart(feature) {
              //console.log(feature.id + ' is ready to be modified');
              drawControls[scope.geometry].deactivate();

            }

            function onModification(feature) {
              //console.log(feature.id + ' has been modified');
              var wktValue = generateWKT(feature);
              scope.bindModel = wktValue;
              scope.$apply();
            }

            function onModificationEnd(feature) {
              //console.log(feature.id + ' is finished to be modified');
              drawControls[scope.geometry].activate();
            }

            // init openlayers
            init();

            // set geometry-input-input
            var control = drawControls[scope.geometry];
            control.activate();
          }
        };
      }
    };
  }]);

angular.module('ui.jassa.rdf-term-input', [])

.directive('rdfTermInput', ['$parse', function($parse) {

    // Some vocab - later we could fetch labels on-demand based on the uris.
    var vocab = {
        iri: 'http://iri',
        plainLiteral: 'http://plainLiteral',
        typedLiteral: 'http://typedLiteral'
    };

    return {
        restrict: 'EA',
        priority: 0,
        //transclude: true,
        require: '^ngModel',
        templateUrl: 'template/rdf-term-input/rdf-term-input.html',
        replace: true,
        //scope: true,
        scope: {
            //ngModel: '=',
            bindModel: '=ngModel',
            ngModelOptions: '=?',
            logo: '@?',
            langs: '=?', // suggestions of available languages
            datatypes: '=?', // suggestions of available datatypes
            rightButton: '=?'
        },
        controller: ['$scope', function($scope) {

            $scope.state = $scope.$state || {};
            $scope.ngModelOptions = $scope.ngModelOptions || {};

            this.setRightButton = function() {
              $scope.rightButton = true;
            };

            $scope.vocab = vocab;

            $scope.termTypes = [
                {id: vocab.iri, displayLabel: 'IRI'},
                {id: vocab.plainLiteral, displayLabel: 'plain'},
                {id: vocab.typedLiteral, displayLabel: 'typed'}
            ];

            var langs = [
                {id: '', displayLabel: '(none)'},
                {id: 'en', displayLabel: 'en'},
                {id: 'de', displayLabel: 'de'},
                {id: 'fr', displayLabel: 'fr'},
                {id: 'zh', displayLabel: 'zh'},
                {id: 'ja', displayLabel: 'ja'}
            ];

//            setModelAttr: function(attr, val) {
//                ngModel.$modelValue[attr] = val;
//                $scope.apply();
//            };

            /*
            $scope.termTypes = [vocab.iri, vocab.plainLiteral, vocab.typedLiteral];

            $scope.termTypeLabels = {};
            $scope.termTypeLabels[vocab.iri] = 'IRI';
            $scope.termTypeLabels[vocab.plainLiteral] = 'plain';
            $scope.termTypeLabels[vocab.typedLiteral] = 'typed';
            */


            $scope.langs = $scope.langs || langs;

            var keys = Object.keys(jassa.vocab.xsd);
            $scope.datatypes = keys.map(function(key) {

                var id = jassa.vocab.xsd[key].getUri();
                return {
                    id: id,
                    displayLabel: jassa.util.UriUtils.extractLabel(id)
                };
            });

            $scope.addLanguage = function(newLanguageValue) {
              return {
                id: newLanguageValue,
                displayLabel: newLanguageValue
              };
            };

            $scope.addDatatype = function(newDatatypeValue) {
              return {
                id: newDatatypeValue,
                displayLabel: newDatatypeValue
              };
            };

        }],
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ngModel) {

                    scope.rightButton = false;



                    scope.setRightButton = function() {
                      scope.rightButton = true;
                    };

                    var getValidState = function() {
                        var result;

                        var state = scope.state;
                        // {"type":{"id":"http://typedLiteral","displayLabel":"typed"},"value":"297.6","datatype":"http://dbpedia.org/datatype/squareKilometre"}
                        var type = state.type;
                        switch(type) {
                        case vocab.iri:
                            result = {
                                type: 'uri',
                                value: state.value
                            };
                            break;
                        case vocab.plainLiteral:
                            result = {
                                type: 'literal',
                                value: state.value,
                                lang: state.lang,
                                datatype: ''
                            };
                            break;
                        case vocab.typedLiteral:
                            result = {
                                type: 'literal',
                                value: state.value,
                                datatype: state.datatype || jassa.vocab.xsd.xstring.getUri()
                            };
                            break;
                        default:
                            result = {
                                type: 'uri',
                                value: state.value
                            };
                            break;
                        }

                        return result;
                    };

                    var convertToState = function(talisJson) {
                        // IMPORTANT: We cannot apply defaults here on the value taken from the model,
                        // because otherwise
                        // we would expose the state based on the defaults, which could
                        // in turn update the model again and modify its value
                        // Put differently: The model must not be changed unless there is user interaction
                        // with this widget!

                        //var clone = createTalisJsonObjectWithDefaults(talisJson);
                        var clone = talisJson;

                        if(clone.type != null && clone.value == null) {
                            clone.value = '';
                        }

                        var node;
                        try {
                            node = jassa.rdf.NodeFactory.createFromTalisRdfJson(clone);
                        } catch(err) {
                            // Ignore invalid model values, and just wait for them to become valid
                            //console.log(err);
                        }


                        var result;
                        if(!node) {
                            result = {};
                        } else if(node.isUri()) {
                            result = {
                                type: vocab.iri,
                                value: node.getUri()
                            };
                        } else if(node.isLiteral()) {
                            var dt = node.getLiteralDatatypeUri();
                            var hasDatatype = !jassa.util.ObjectUtils.isEmptyString(dt);

                            if(hasDatatype) {
                                result = {
                                    type: vocab.typedLiteral,
                                    value: node.getLiteralLexicalForm(),
                                    datatype: dt
                                };
                            } else {
                                result = {
                                    type: vocab.plainLiteral,
                                    value: node.getLiteralLexicalForm(),
                                    lang: node.getLiteralLanguage()
                                };
                            }
                        }

                        return result;
                    };

                    scope.$watch(function () {
                        var r = scope.bindModel;
                        return r;
                    }, function(talisJson) {
                        //console.log('Got outside change: ', talisJson);

                      if (!talisJson) {
                      } else {
                          var newState = convertToState(talisJson);

  //                            var newState;
  //                            try {
  //                                newState = convertToState(talisJson);
  //                            } catch(err) {
  //                                newState = {};
  //                            }

                          scope.state = newState;

                          // init value of ui-select-box termtype
                          for (var i in scope.termTypes) {
                            if (scope.termTypes[i].id === scope.state.type) {
                              scope.termTypes.selected = scope.termTypes[i];
                              break;
                            }
                          }

                          // init value of ui-select-box datatype
                          var matchedDatatype = false;
                          for (var j in scope.datatypes) {
                            if (scope.datatypes[j].id === scope.state.datatype) {
                              scope.datatypes.selected = scope.datatypes[j];
                              matchedDatatype = true;
                              break;
                            }
                          }

                          // if the datatype is not in hashmap add them
                          if (!matchedDatatype) {
                            //TODO: short uri for displayLabel
                            var prefixMapping = new jassa.rdf.PrefixMappingImpl();
                            // create new datatype set
                            var newDatatype = {
                              id: scope.state.datatype,
                              displayLabel:  prefixMapping.shortForm(scope.state.datatype)
                            };
                            // add new datatype to datatypes
                            scope.datatypes.push(newDatatype);
                            // set datatype as selected
                            scope.datatypes.selected = newDatatype;
                          }

                          // init value of ui-select-box languages
                          var matchedLang = false;
                          for (var k in scope.langs) {
                            if (scope.langs[k].id === scope.state.lang) {
                              scope.langs.selected = scope.langs[k];
                              matchedLang = true;
                              break;
                            }
                          }

                          // if the language is not in hashmap add them
                          if (!matchedLang) {
                            // create new datatype set
                            var newLang = {
                              id: scope.state.lang,
                              displayLabel: scope.state.lang
                            };
                            // add new language to langs
                            scope.langs.push(newLang);
                            // set datatype as selected
                            scope.langs.selected = newLang;
                          }

                        //console.log('ABSORBED', newState, ' from ', talisJson);
                      }
                    }, true);

                    //if(modelSetter) {

                        scope.$watch(function () {
                            var r = getValidState();
                            return r;
                        }, function(newValue) {
                            if(newValue) {
                                //modelSetter(scope, newValue);
                                //scope.bindModel = newValue;
                                angular.copy(newValue, scope.bindModel);

                                //if(!scope.$phase) { scope.$apply(); }
                                //console.log('EXPOSED', scope.bindModel);
                            }
                        }, true);
                    //}
                }


                // Code below worked with scope:true - but we want an isolated one
                    /*
                    var modelExprStr = attrs['ngModel'];
                    var modelGetter = $parse(modelExprStr);
                    var modelSetter = modelGetter.assign;

                    //console.log('Sigh', modelExprStr, modelGetter(scope));

                    scope.$watch(function () {
                        var r = modelGetter(scope);
                        return r;
                    }, function(talisJson) {
                        //console.log('Got outside change: ', talisJson);

                        if(talisJson) {
                            var newState = convertToState(talisJson);
                            scope.state = newState;
                            //console.log('ABSORBED', newState, ' from ', talisJson);
                        }
                    }, true);

                    if(modelSetter) {

                        scope.$watch(function () {
                            var r = getValidState();
                            return r;
                        }, function(newValue) {
                            if(newValue) {
                                modelSetter(scope, newValue);
                                //console.log('EXPOSED', newValue);
                            }
                        }, true);
                    }
                }
                */
            };
        }
    };
}]);




/**
 * Falsy valued arguments will be replaced with empty strings or 0
 */
var Coordinate = Jassa.ext.Class.create({
    initialize: function(s, p, i, c) {
        this.s = s || '';
        this.p = p || '';
        this.i = i || 0;
        this.c = c || '';
    },

    equals: function(that) {
        var result = this.s === that.s && this.p === that.p && this.i === that.i && this.c === that.c;
        return result;
    },

    hashCode: function() {
        if(this.hash == null) {
            this.hash =
                jassa.util.ObjectUtils.hashCodeStr(this.s) +
                3 * jassa.util.ObjectUtils.hashCodeStr(this.p) +
                7 * this.i +
                11 * jassa.util.ObjectUtils.hashCodeStr(this.c);
        }

        return this.hash;
    },

    toString: function() {
        var result = this.s + ' ' + this.p + ' ' + this.i + ' ' + this.c;
        return result;
    },
});

// Prefix str:
var parsePrefixStr = function(str) {
    regex = /\s*([^:]+)\s*:\s*([^\s]+)\s*/g;
};


var parsePrefixes = function(prefixMapping) {
    var result = prefixMapping
        ? prefixMapping instanceof PrefixMappingImpl
            ? prefixMapping
            : new PrefixMappingImpl(prefixMapping)
        : new PrefixMappingImpl();

    return result;
};


var getModelAttribute = function(attrs) {
    var modelAttrNames = ['ngModel', 'model'];

    var keys = Object.keys(attrs);

    var result = null;
    modelAttrNames.some(function(item) {
        var r = keys.indexOf(item) >= 0;
        if(r) {
            result = item;
        }
        return r;
    });

    return result;
};


function capitalize(s)
{
    return s && s[0].toUpperCase() + s.slice(1);
}

// TODO We need to expand prefixed values if the termtype is IRI

/**
 *
 * @param oneWay If true, the model is not updated on rexContext changes for the respective coordinate
 *
 */
var createCompileComponent = function($rexComponent$, $component$, $parse, oneWay) {
    //var $rexComponent$ = 'rex' + capitalize($component$);
//if(true) { return; }

    var tag = '[' + $component$ + ']';

    return {
        pre: function(scope, ele, attrs, ctrls) {


            var modelExprStr = attrs[$rexComponent$];
            var modelGetter = $parse(modelExprStr);
            var modelSetter = modelGetter.assign;

            if(!oneWay) {
                syncAttr($parse, scope, attrs, $rexComponent$);
            }

            var contextCtrl = ctrls[0];

            // ngModel Used for pristine/dirty checking
            var ngModel = ctrls[2];
            //var objectCtrl = ctrls[1];

            var slot = contextCtrl.allocSlot();
            slot.entry = {};

            scope.$on('$destroy', function() {
//console.log('Destroying compile component ' + tag);

                slot.release();
            });

//console.log('Start: Creating compile component ' + tag);

            // If the coordinate changes AND the model is not pristine,
            // we copy the value at the override's old coordinate to the new coordinate
            // This way we ensure we are not overwriting a user's input
            // Otherwise (if the model is pristine), just set the model to the value of the current base data
            scope.$watch(function() {
                var r = createCoordinate(scope, $component$);
                return r;
            }, function(newCoordinate, oldCoordinate) {
                // Tell the context the coordinate we are referring to
                slot.entry.key = newCoordinate;

                if(!ngModel || !ngModel.$pristine) {

                    var oldValue = getEffectiveValue(scope.rexContext, oldCoordinate); //scope.rexContext.getValue(oldCoordinate);
                    if(oldValue) {
                        var entry = {
                            key: newCoordinate,
                            val: oldValue
                        };

                        //contextCtrl.getOverride().putEntries([entry]);
                        setValueAt(contextCtrl.getOverride(), entry.key, entry.val);
                    }
                } else {
                    // If the model is pristine, we do not update the override
                    // instead we set the model to the source value for the given coordinate
                    if(modelSetter) {
                        // If the given model is writeable, then we need to update it
                        // whenever the coordinate's value changes

                        var value = getValueAt(scope.rexContext.json, newCoordinate);
//                        if(value == null) {
//                            value = '';
//                        }
                        modelSetter(scope, value);
                    }

                }
            }, true);


            // If the effective value at a coordinate changes, update the model
            // Note: By default, if the effective value equals the source data, we reset the pristine flag
            if(!oneWay) {
                scope.$watch(function() {
                    var coordinate = slot.entry.key;
                    var r = getEffectiveValue(scope.rexContext, coordinate); //scope.rexContext.getValue(coordinate);
                    return r;

                }, function(value) {
                    var coordinate = slot.entry.key;

                    var entry = {
                        key: coordinate,
                        val: value
                    };

                    //console.log('Value at coordinate ')

                    if(value != null) {
                        //contextCtrl.getOverride().putEntries([entry]);
                        setValueAt(contextCtrl.getOverride(), entry.key, entry.val);
                    }

                    slot.entry.value = value;

                    if(modelSetter) {
                        // If the given model is writeable, then we need to update it
                        // whenever the coordinate's value changes

                        if(value != null) {
                            modelSetter(scope, value);
                        }
                    }

                    var isEmpty = function(str) {
                        return str == null || str === '';
                    };

                    // Note: If the effective value equals the source value, we reset the pristine flag
                    // This way, if the user manually restores changes to a value, the model is considered clean again
                    //  Right now, we treat null and '' as equivalent.
                    // ISSUE: Now, we have the undesired effect, that if fields of a resource map to parts of its URI,
                    // then once data for the URI is retrieved, then the data that is input into the field then matches the data retrieved
                    // caused the field to be considered pristine - hence, editing any of the fields the URI depends on will
                    // cause all other fields to go blank again
                    // I see the following options:
                    // - We introduce a flag whether equal values count as pristine; e.g. rex-pristine-on-equals
                    //   Note that this seems similar to the masterValue concept of https://github.com/betsol/angular-input-modified
                    // - In the form there have to be buttons for resetting the pristine state explicitly
                    // Anyway, for now we disable the following snipped
//                    if(ngModel) {
//                        var srcValue = getValueAt(scope.rexContext.json, coordinate);
//                        if(srcValue === value || isEmpty(srcValue) && isEmpty(value)) {
//                            ngModel.$setPristine();
//                        }
//                    }

                }, true);
            }

            // TODO: Probably outdated: Forwards: If the model changes, we need to update the change object in the scope

            // If the model value changes, we need to update the override to reflect this
            scope.$watch(function() {
                var r = modelGetter(scope);

                return r;
            }, function(newVal, oldVal) {

                var coordinate = slot.entry.key;//createCoordinate(scope, $component$);
                var entry = {
                    key: coordinate,
                    val: newVal
                };
                slot.entry.val = newVal;

                if(newVal != null) {
                    //contextCtrl.getOverride().putEntries([entry]);
                    setValueAt(contextCtrl.getOverride(), entry.key, entry.val);
                }
//                else {
//                    // Remove null values
//                    // TODO Can this happen?
//                    contextCtrl.getOverride().remove(coordinate);
//                }

                //console.log(tag + ' Model changed to ', newVal, ' from ', oldVal, ' at coordinate ', coordinate, '; updating override ', slot.entry);
            }, true);
//console.log('Done: Creating compile component ' + tag);

        }

    };
};

var assembleTalisRdfJson = function(map) {
    //console.log('Assembling talis rdf json');
    var result = {};

    var entries = map.entries();

    entries.forEach(function(entry) {
        var coordinate = entry.key;

        var check = new Coordinate(
            coordinate.s,
            coordinate.p,
            coordinate.i,
            'deleted'
        );

        var isDeleted = map.get(check);

        if(!isDeleted) {
            var str = entry.val;

            var s = result;
            var p = s[coordinate.s] = s[coordinate.s] || {};
            var x = p[coordinate.p] = p[coordinate.p] || [];
            var o = x[coordinate.i] = x[coordinate.i] || {};

            o[coordinate.c] = str;
        }
    });



    return result;
};

/**
 * In place processing of prefixes in a Talis RDF JSON structure.
 *
 * If objects have a prefixMapping attribute, value and datatype fields
 * are expanded appropriately.
 *
 */
var processPrefixes = function(talisRdfJson, prefixMapping) {
    var result = {};

    var sMap = talisRdfJson;
    var ss = Object.keys(sMap);
    ss.forEach(function(s) {
        var pMap = sMap[s];
        var ps = Object.keys(pMap);

        ps.forEach(function(p) {
           var iArr = pMap[p];

           iArr.forEach(function(cMap) {
               //var pm = cMap.prefixMapping;
               var pm = prefixMapping;

               if(pm) {
                   if(cMap.type === 'uri') {
                       var val = cMap.value;
                       cMap.value = pm.expandPrefix(val);
                   } else if(cMap.type === 'literal' && cMap.datatype != null) {
                       var datatype = cMap.datatype;

                       cMap.datatype = pm.expandPrefix(datatype);
                   }

                   //delete cMap['prefixMapping'];
               }
           });
        });
    });

    return result;
};


//var __defaultPrefixMapping = new jassa.rdf.PrefixMappingImpl(jassa.vocab.InitialContext);

var createCoordinate = function(scope, component) {
    var pm = scope.rexPrefixMapping || new jassa.rdf.PrefixMappingImpl(jassa.vocab.InitialContext);
    //__defaultPrefixMapping;

    return new Coordinate(
        pm.expandPrefix(scope.rexSubject),
        pm.expandPrefix(scope.rexPredicate),
        scope.rexObject,
        component
    );
};


//var _array = {
//    create: function() {
//        return [];
//    },
//    put: function(arr, index, value) {
//        data[index] = value;
//    },
//    get: function(arr, index) {
//        return data[index];
//    },
//    remove: function(arr, index) {
//        arr.splice(index, 1);
//    }
//};
//
//var _obj = {
//    create: function() {
//        return {};
//    },
//    put: function(obj, key, value) {
//        obj[key] = value;
//    },
//    get: function(obj, key) {
//        return obj[key];
//    },
//    remove: function(arr, key) {
//        delete obj[key];
//    }
//};
//
//var rdfSchema = [{
//    id: 's',
//    type: _obj
//}, {
//    id: 'p'
//    type: _obj
//}, {
//    id: 'i',
//    type: _array
//}, {
//    id: 'c',
//    type: _obj
//}
//];
//
//var NestedMap = jassa.ext.Class.create({
//    /**
//     * schema: []
//     */
//    initialize: function(schema) {
//        this.schema = schema;
//    },
//
//    put: function(coordinate, value) {
//
//    },
//
//    get: function(coordinate, value) {
//
//    },
//
//    remove: function(coordinate) {
//
//    }
//})


var talisRdfJsonToEntries = function(talisRdfJson) {
    var result = [];

    var sMap = talisRdfJson;
    var ss = Object.keys(sMap);
    ss.forEach(function(s) {
        var pMap = sMap[s];
        var ps = Object.keys(pMap);

        ps.forEach(function(p) {
           var iArr = pMap[p];

           //for(var i = 0; i < iArr.length; ++i) {
           var i = 0;
           iArr.forEach(function(cMap) {
               var cs = Object.keys(cMap);

               cs.forEach(function(c) {
                   var val = cMap[c];

                   var coordinate = new Coordinate(s, p, i, c);

                   result.push({
                       key: coordinate,
                       val: val
                   });
               });
               ++i;
           });

        });

    });

    return result;
};



// Returns the object array at a given predicate
var getObjectsAt = function(talisRdfJson, coordinate) {
    var s = talisRdfJson[coordinate.s];
    var result = s ? s[coordinate.p] : null;
    return result;
};

// Returns the object at a given index
var getObjectAt = function(talisRdfJson, coordinate) {
    var p = getObjectsAt(talisRdfJson, coordinate);
    var result = p ? p[coordinate.i] : null;

    return result;
};

var getOrCreateObjectAt = function(talisRdfJson, coordinate, obj) {
    var s = talisRdfJson[coordinate.s] = talisRdfJson[coordinate.s] || {};
    var p = s[coordinate.p] = s[coordinate.p] || [];
    var result = p[coordinate.i] = p[coordinate.i] || obj || {};
    return result;
};

var removeObjectAt = function(talisRdfJson, coordinate) {
    var s = talisRdfJson[coordinate.s];
    var p = s ? s[coordinate.p] : null;
    //var i = p ? p[coordinate.i] : null;

    if(p) {
        p.splice(coordinate.i, 1);

        if(p.length === 0) {
            delete s[coordinate.p];
        }
    }
};

var removeValueAt = function(talisRdfJson, coordinate) {

    var s = talisRdfJson[coordinate.s];
    var p = s ? s[coordinate.p] : null;
    var i = p ? p[coordinate.i] : null;
    //var c = i ? i[coordinate.c] : null;

    if(i) {
        delete i[coordinate.c];

        if(i.length === 0) {
            delete p[coordinate.p];

            if(Object.keys(p).length === 0) {
                delete s[coordinate.s];
            }
        }
    }
};

var setValueAt = function(talisRdfJson, coordinate, value) {
    if(value != null) {
        var o = getOrCreateObjectAt(talisRdfJson, coordinate);
        o[coordinate.c] = value;
    }
};

// TODO Rename to getComponentAt
var getValueAt = function(talisRdfJson, coordinate) {
    var i = getObjectAt(talisRdfJson, coordinate);
    var result = i ? i[coordinate.c] : null;

    return result;
};


var diff = function(before, after) {
    var result = new jassa.util.HashSet();

    after.forEach(function(item) {
        var isContained = before.contains(item);
        if(!isContained) {
            result.add(item);
        }
    });

    return result;
};


var setDiff = function(before, after) {

    var result = {
        added: diff(before, after),
        removed: diff(after, before)
    };

    return result;
};

var getEffectiveValue = function(rexContext, coordinate) {
    //var result = rexContext.override ? rexContext.override.get(coordinate) : null;
    var result = rexContext.override ? getValueAt(rexContext.override, coordinate) : null;

    if(result == null) {
        result = rexContext.json ? getValueAt(rexContext.json, coordinate) : null;
    }

    return result;
};


/**
 * One way binding of the value of an attribute into scope
 * (possibly via a transformation function)
 *
 */
var syncAttr = function($parse, $scope, attrs, attrName, deep, transformFn) {
    var attr = attrs[attrName];
    var getterFn = $parse(attr);

    var updateScopeVal = function(val) {
        var v = transformFn ? transformFn(val) : val;

        $scope[attrName] = v;
    };

    $scope.$watch(function() {
        var r = getterFn($scope);
        return r;
    }, function(newVal, oldVal) {
        //console.log('Syncing: ', attrName, ' to ', newVal, ' in ', $scope);
        updateScopeVal(newVal);
    }, deep);

    var result = getterFn($scope);
    // Also init the value immediately
    updateScopeVal(result);

    return result;
};


var setEleAttrDefaultValue = function(ele, attrs, attrName, defaultValue) {
    var result = ele.attr(attrName);
    if(!result) { // includes empty string
        result = defaultValue;
        ele.attr(attrName, result);

        var an = attrs.$normalize(attrName);
        attrs[an] = result;
    }
    return result;
};






// TODO Create a util for id allocation

// NOTE: We should make a rex module only for the annotations without the widgets, so that the annotations would not depend on ui.select
angular.module('ui.jassa.rex', ['dddi', 'ui.select']);

//var basePriority = 0;

angular.module('ui.jassa.rex')


.directive('rexContext', ['$parse', function($parse) {
    return {
        priority: 30,
        restrict: 'A',
        scope: true,
        require: 'rexContext',
        controller: ['$scope', function($scope) {

            $scope.rexContext = $scope.rexContext || {};

            this.$scope = $scope;


            //$scope.override = new jassa.util.HashMap();

            //this.rexContext = $scope.rexContext;
            this.getOverride =    function() {
                //return $scope.override;
                var rexContext = $scope.rexContext;
                var r = rexContext ? rexContext.override : null;
                return r;
            };


            // Attribute where child directives can register changes
            //this.rexChangeScopes = $scope.rexChangeScopes = [];

            // Arrays where child directives can register slots where
            // they publish their change
            this.nextSlot = 0;
            $scope.rexChangeSlots = {};

            //console.log('DA FUQ');

            //this.rexChangeSlots =

            this.allocSlot = function() {
                var tmp = this.nextSlot++;
                var id = '' + tmp;

                //var self = this;

                //console.log('[SLOT]: Allocated ' + id);

                var result = $scope.rexChangeSlots[id] = {
                    id: id,
                    release: function() {
                        //console.log('[SLOT]: Released ' + id);
                        delete $scope.rexChangeSlots[id];

                        //console.log('[SLOT]: In Use ' + Object.keys(self.rexChangeSlots).length);
                    }
                };

                return result;
            };

            this.getSlots = function() {
                var slots = $scope.rexChangeSlots;
                var slotIds = Object.keys(slots);

                var result = slotIds.map(function(slotId) {
                    var slot = slots[slotId];
                    return slot;
                });

                return result;
            };

            // Iterate all slots and create a graph from all .triples attributes
            this.getEnforcedGraph = function() {
                var result = new jassa.rdf.GraphImpl();
                var slots = this.getSlots();
                slots.forEach(function(slot) {
                    var triples = slot.triples;

                    if(triples) {
                        result.addAll(triples);
                    }
                });

                return result;
            };

            // Iterate all slots and collect referenced coordinates
            this.getReferencedCoordinates = function() {
                var result = new jassa.util.HashSet();

                var slots = this.getSlots();
                slots.forEach(function(slot) {
                    var entry = slot.entry;

                    var coordinate = entry ? entry.key : null;
                    if(coordinate != null) {
                        result.add(coordinate);
                    }
                });

                return result;
            };

//            this.releaseSlot = function(slot) {
//                delete this.changeSlots[slot.id];
//            }

        }],

        compile: function(ele, attrs) {

            setEleAttrDefaultValue(ele, attrs, 'rex-context', 'rexContext');

            return {
                pre: function(scope, ele, attrs, ctrl) {

                    // If no context object is provided, we create a new one
//                    if(!attrs.rexContext) {
//                        scope.rexContextAnonymous = {};
//                        //attrs.rexContext = 'rexContextAnonymous';
//                    }

                    syncAttr($parse, scope, attrs, 'rexContext');


                    var initContext = function(rexContext) {
                        rexContext.override = rexContext.override || {};//  new jassa.util.HashMap();

                        rexContext.remove = rexContext.remove || function(coordinate) {
                            // Removes an object
                            var objs = getObjectsAt(rexContext.json, coordinate);
                            if(objs) {
                                objs.splice(coordinate.i, 1);
                            }

                            objs = getObjectsAt(rexContext.override, coordinate);
                            if(objs) {
                                objs.splice(coordinate.i, 1);
                            }
                        };

                        /*
                        rexContext.setObject = function(s, p, i, sourceObj) {
                            var coordinate = new Coordinate(s, p, i);
                            var targetObj = getOrCreateObjectAt(rexContext.override, coordinate);
                            angular.copy(sourceObj, targetObj);
                            //setObjectAt(rexContext.override, coordinate, value) {
                        };
                        */
/* TODO I think it is not used anymore, but code left here for reference
                        rexContext.addObject = function(_s, _p, sourceObj) {
                            var pm = scope.rexPrefixMapping || new jassa.rdf.PrefixMappingImpl(jassa.vocab.InitialContext);
                            //__defaultPrefixMapping;

                            var s = pm.expandPrefix(_s);
                            var p = pm.expandPrefix(_p);

                            var coordinate = new Coordinate(s, p);

                            var as = getObjectsAt(rexContext.json, coordinate);
                            var bs = getObjectsAt(rexContext.override, coordinate);

                            var a = as ? as.length : 0;
                            var b = bs ? bs.length : 0;

                            var i = Math.max(a, b);

                            var c = new Coordinate(s, p, i);

                            var targetObj = getOrCreateObjectAt(rexContext.override, c);
                            angular.copy(sourceObj, targetObj);
                            //setObjectAt(rexContext.override, coordinate, value) {
                        };
*/

                    };

                    // Make sure to initialize any provided context object
                    // TODO: The status should probably be part of the context directive, rather than a context object
                    scope.$watch(function() {
                        return scope.rexContext;
                    }, function(newVal) {
                        initContext(newVal);
                    });

                    initContext(scope.rexContext);

                    var getBaseGraph = function() {
                        var rexContext = scope.rexContext;
                        var r = rexContext ? rexContext.baseGraph : null;
                        return r;
                    };

                    // Synchronize the talis json structure with the graph
                    // TODO Performance-bottleneck: Synchronize via an event API on the Graph object rather than using Angular's watch mechanism
                    scope.$watch(function() {
                        var baseGraph = getBaseGraph();
                        var r = baseGraph ? baseGraph.hashCode() : null;
                        return r;
                    }, function() {
                        var baseGraph = getBaseGraph();
                        scope.rexContext.json = baseGraph ? jassa.io.TalisRdfJsonUtils.triplesToTalisRdfJson(baseGraph) : {};
                    });


                    /*
                    var getComponentValueForNode = function(node, component) {
                        var json = jassa.rdf.NodeUtils.toTalisRdfJson(node);
                        var result = json[compononte];
                        return result;
                    };

                    // A hacky function that iterates the graph
                    getValue: function(graph, coordinate) {

                    }
                    */









                    // TODO Watch any present sourceGraph attribute
                    // And create the talis-json structure

                    // The issue is, that the source graph might become quite large
                    // (e.g. consider storing a whole DBpedia Data ID in it)
                    // Would it be sufficient to only convert the subset of the graph
                    // to RDF which is referenced by the form?

//                    scope.$watch(function() {
//                        return scope.rexSourceGraph;
//                    }, function(sourceGraph) {
//                        scope.rexJson = jassa.io.TalisRdfJsonUtils.triplesToTalisRdfJson(sourceGraph);
//                    }, true);


                    // Remove all entries from map that exist in base
//                    var mapDifference = function(map, baseFn) {
//                        var mapEntries = map.entries();
//                        mapEntries.forEach(function(mapEntry) {
//                            var mapKey = mapEntry.key;
//                            var mapVal = mapEntry.val;
//
//                            var baseVal = baseFn(mapKey);
//
//                            if(jassa.util.ObjectUtils.isEqual(mapVal, baseVal)) {
//                                map.remove(mapKey);
//                            }
//                        });
//                    };

                    var createDataMap = function(coordinates) {

                        //var override = scope.rexContext.override;
                        var override = ctrl.getOverride();

                        //console.log('Override', JSON.stringify(scope.rexContext.override.entries()));

                        //var combined = new jassa.util.HashMap();

                        //console.log('Coordinates: ', JSON.stringify(coordinates));
                        //var map = new MapUnion([scope.rexContext.override, scope.rex]);
                        var result = new jassa.util.HashMap();
                        coordinates.forEach(function(coordinate) {
                             //var val = scope.rexContext.getValue(coordinate);
                            var val = getEffectiveValue(scope.rexContext, coordinate);
                            result.put(coordinate, val);
                        });

                        //console.log('DATA', result.entries());

                        return result;
                    };

                    var dataMapToGraph = function(dataMap, prefixMapping) {
                        var talis = assembleTalisRdfJson(dataMap);
                        processPrefixes(talis, prefixMapping);

                        // Update the final RDF graph
                        var result = jassa.io.TalisRdfJsonUtils.talisRdfJsonToGraph(talis);
                        return result;
                    };

                    var updateDerivedValues = function(dataMap, prefixMapping) {
//console.log('Start update derived');
                        /*
                        var talis = assembleTalisRdfJson(dataMap);
                        processPrefixes(talis, prefixMapping);

                        // Update the final RDF graph
                        var targetGraph = jassa.io.TalisRdfJsonUtils.talisRdfJsonToGraph(talis);
                        */
                        var targetGraph = dataMapToGraph(dataMap, prefixMapping);

                        var enforcedGraph = ctrl.getEnforcedGraph();
                        // TODO Remove from enforcedGraph those triples that are already present in the source data
                        //enforcedGraph.removeAll();
                        targetGraph.addAll(enforcedGraph);



                        scope.rexContext.graph = targetGraph;

                        scope.rexContext.targetJson = jassa.io.TalisRdfJsonUtils.triplesToTalisRdfJson(targetGraph);

                        // Update the referenced sub graph
                        var refGraph = new jassa.rdf.GraphImpl();
                        var coordinates = ctrl.getReferencedCoordinates();

                        var srcJson = scope.rexContext.json;

                        coordinates.forEach(function(coordinate) {
                            var obj = getObjectAt(srcJson, coordinate);
                            if(obj != null) {
                                var o = jassa.rdf.NodeFactory.createFromTalisRdfJson(obj);

                                var s = jassa.rdf.NodeFactory.createUri(coordinate.s);
                                var p = jassa.rdf.NodeFactory.createUri(coordinate.p);

                                var t = new jassa.rdf.Triple(s, p, o);
                                refGraph.add(t);
                            }
                        });

                        scope.rexContext.srcGraph = refGraph;

                        scope.rexContext.diff = setDiff(refGraph, targetGraph);
//console.log('End update derived');


                        //console.log('Talis JSON', talis);
                        //var turtle = jassa.io.TalisRdfJsonUtils.talisRdfJsonToTurtle(talis);


                        //var tmp = assembleTalisRdfJson(scope.rexContext.cache);

                        //var before = jassa.io.TalisRdfJsonUtils.talisRdfJsonToTriples(tmp).map(function(x) { return '' + x; });

                        //var after = jassa.io.TalisRdfJsonUtils.talisRdfJsonToTriples(talis).map(function(x) { return '' + x; });
                        //var remove = _(before).difference(after);
                        //var added = _(after).difference(before);

                        //console.log('DIFF: Added: ' + added);
                        //console.log('DIFF: Removed: ' + remove);

                        //scope.rexContext.talisJson = turtle;
                    };


                    var cleanupOverride = function()
                    {
                        var json = scope.rexContext.json;
                        var override = ctrl.getOverride();
                        //var override = scope.rexContext.override;

                        // Remove values from override that equal the source data
                        var entries = talisRdfJsonToEntries(override);
                        entries.forEach(function(entry) {
                            var coordinate = entry.key;
                            var val = entry.val;

                            var sourceVal = getValueAt(json, coordinate);
                            if(sourceVal === val || val == null) {
                                removeValueAt(override, coordinate);
                            }
                        });

                        /*
                        mapDifference(override, function(coordinate) {
                            var r = getValueAt(scope.rexContext.json, coordinate);
                            return r;
                        });
                        */

                        // Remove undefined entries from override
//                        var entries = override.entries();
//                        entries.forEach(function(entry) {
//                            if(entry.val == null) {
//                                override.remove(entry.key);
//                            }
//                        });
                    };


                    var cleanupReferences = function(coordinateSet) {
                        //coordinates = coordinates || ctrl.getReferencedCoordinates();

                        //console.log('Referenced coordinates', JSON.stringify(coordinates));
                        //var coordinateSet = jassa.util.SetUtils.arrayToSet(coordinates);

                        var override = ctrl.getOverride();
                        //jassa.util.MapUtils.retainKeys(override, coordinateSet);
                        var entries = talisRdfJsonToEntries(override);

                        entries.forEach(function(entry) {
                            var coordinate = entry.key;
                            var isContained = coordinateSet.contains(coordinate);
                            if(!isContained) {
                                removeValueAt(override, coordinate);
                            }
                        });

                        //console.log('Override after cleanup', JSON.stringify(scope.rexContext.override.keys()));
                    };


                    var currentCoordinateSet = new jassa.util.HashSet();
                    /*
                    var hashCodeArr = function(arr) {
                        var result = 0;
                        var l = arr ? arr.length : 0;
                        for (var i = 0; i < l; i++) {
                            var item = arr[i];
                            var hashCode = item.hashCode ? item.hashCode : 127;
                            result = result * 31 + hashCode;
                            res = res & res;
                        }

                        return result;
                    };
                    */

                    // TODO The following two $watch's have linear complexity but
                    // could be optimized if we managed references in a more
                    // clever way

                    // TODO Remove unreferenced values from the override
                    scope.$watch(function() {
                        currentCoordinateSet = ctrl.getReferencedCoordinates();

                        var r = currentCoordinateSet.hashCode();
                        //console.log('coordinateSetHash: ', r);
                        return r;
                    }, function() {
                        //console.log('Override', scope.rexContext.override);
                        cleanupReferences(currentCoordinateSet);
                        cleanupOverride();
                    }, true);

                    var currentDataMap = new jassa.util.HashMap();

                    scope.$watch(function() {
                        currentDataMap = createDataMap(currentCoordinateSet);
                        var r = currentDataMap.hashCode();
                        //console.log('dataMapHash: ', r);
                        return r;
                    }, function(dataMap) {

                        var rexContext = scope.rexContext;
                        var prefixMapping = rexContext ? rexContext.prefixMapping : null;

                        updateDerivedValues(currentDataMap, prefixMapping);
                    }, true);


                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexDatatype', ['$parse', function($parse) {
    return {
        priority: 7,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexObject', '?ngModel'],
        controller: angular.noop,
        compile: function(scope, ele, attrs, ctrls) {
            return createCompileComponent('rexDatatype', 'datatype', $parse);
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * Directive to mark triples as deleted
 *
 */
.directive('rexDeleted', ['$parse', function($parse) {
    return {
        priority: 7,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexObject'],
        controller: angular.noop,
        compile: function(ele, attrs) {
            return createCompileComponent('rexDeleted', 'deleted', $parse);
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * Convenience directive
 *
 * rexObjectIri="model"
 *
 * implies rex-object rex-termtype="iri" rex-value="model"
 */
.directive('rexIri', ['$parse', '$compile', function($parse, $compile) {
    return {
        priority: 900, //+ 1000,
        restrict: 'A',
        scope: true,
        terminal: true,
        controller: angular.noop,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    var modelExprStr = ele.attr('rex-iri');

                    if(jassa.util.ObjectUtils.isEmptyString(modelExprStr)) {
                        var name = getModelAttribute(attrs);
                        modelExprStr = attrs[name];
                    }

                    if(!modelExprStr) {
                        throw new Error('No model provided and found');
                    }


                    ele.removeAttr('rex-iri');

                    ele.attr('rex-object', ''); //'objectIriObject');
                    ele.attr('rex-termtype', '"uri"');
                    ele.attr('rex-value', modelExprStr);

                    // Continue processing any further directives
                    $compile(ele)(scope);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexLang', ['$parse', function($parse) {
    return {
        priority: 7,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexObject', '?ngModel'],
        controller: angular.noop,
        compile: function(scope, ele, attrs, ctrls) {
            return createCompileComponent('rexLang', 'lang', $parse);
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexLiteral', ['$parse', '$compile', function($parse, $compile) {
    return {
        priority: 900,
        restrict: 'A',
        scope: true,
        terminal: true,
        controller: angular.noop,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    var modelExprStr = ele.attr('rex-literal');

                    if(jassa.util.ObjectUtils.isEmptyString(modelExprStr)) {
                        var name = getModelAttribute(attrs);
                        modelExprStr = attrs[name];
                    }

                    if(!modelExprStr) {
                        throw new Error('No model provided and found');
                    }

                    ele.removeAttr('rex-literal');

                    // TODO: Do not overwrite rex-object if already present

                    ele.attr('rex-object', ''); //'objectIriObject');
                    ele.attr('rex-termtype', '"literal"');
                    ele.attr('rex-value', modelExprStr);

                    // Continue processing any further directives
                    $compile(ele)(scope);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * Directive to attach a rex lookup function to the scope
 *
 * Different lookup functions can be used at different HTML regions under a rex-context.
 *
 * If present, rex-subject will use the provided function to perform data lookups
 * on its IRIs and store the content in the scope
 *
 */
.directive('rexLookup', ['$parse', function($parse) {
    return {
        priority: 26,
        restrict: 'A',
        scope: true,
        require: '^rexContext',
        controller: angular.noop,
        //require: ['^?rexSubject', '^?rexObject']
//        controller: ['$scope', function($scope) {
//        }],
        compile: function(ele, attrs){
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    syncAttr($parse, scope, attrs, 'rexLookup');
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * Directive to refer to the set of URIs at a target
 *
 * rexNavTargets="arrayOfTargetIriStrings"
 *
 *
 *
 * Requires:
 * - rex-subject on any ancestor
 * - rex-nav-predicate present on the same element as rex-nav-targets
 *
 * Optional:
 * - rex-nav-inverse Whether to navigate the given predicate in inverse direction\
 *
 */
.directive('rexNavTargets', ['$parse', '$q', '$dddi', function($parse, $q, $dddi) {
    return {
        priority: 10,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexSubject'],
        controller: angular.noop,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {

                    var contextCtrl = ctrls[0];

                    var slot = contextCtrl.allocSlot();
                    slot.triples = [];
                    //slot.entry = {};

                    scope.$on('$destroy', function() {
                        slot.release();
                    });



                    syncAttr($parse, scope, attrs, 'rexNavPredicate');
                    syncAttr($parse, scope, attrs, 'rexNavInverse');


                    var targetModelStr = ele.attr('rex-nav-targets');
                    var dddi = $dddi(scope);

                    dddi.register(targetModelStr, ['rexSparqlService', 'rexSubject', 'rexNavPredicate', '?rexNavInverse',
                        function(sparqlService, subjectStr, predicateStr, isInverse) {

                            var pm = scope.rexPrefixMapping || new jassa.rdf.PrefixMappingImpl(jassa.vocab.InitialContext);

                            subjectStr = pm.expandPrefix(subjectStr);
                            predicateStr = pm.expandPrefix(predicateStr);

                            //var path = new jassa.facete.Path([new jassa.facete.Step(propertyStr, isInverse)]);

                            var s = jassa.sparql.VarUtils.s;
                            var p = jassa.rdf.NodeFactory.createUri(predicateStr);
                            //var o = jassa.sparql.VarUtils.o;
                            var o = jassa.rdf.NodeFactory.createUri(subjectStr);

                            var triple = isInverse
                                ? new jassa.rdf.Triple(s, p, o)
                                : new jassa.rdf.Triple(o, p, s)
                                ;

                            var concept = new jassa.sparql.Concept(
                                new jassa.sparql.ElementGroup([
                                    new jassa.sparql.ElementTriplesBlock([triple]),
                                    new jassa.sparql.ElementFilter(new jassa.sparql.E_IsIri(new jassa.sparql.ExprVar(s)))
                                ]), s);

                            var query = jassa.sparql.ConceptUtils.createQueryList(concept);

                            var listService = new jassa.service.ListServiceSparqlQuery(sparqlService, query, concept.getVar());

                            var task = listService.fetchItems().then(function(entries) {
                                var r = entries.map(function(item) {
                                    var s = item.key.getUri();
                                    return s;
                                });

                                return r;
                            });

                            return task;
                    }]);


                    var updateRelation = function(array) {
                        // Convert the array to triples

                        var pm = scope.rexPrefixMapping || new jassa.rdf.PrefixMappingImpl(jassa.vocab.InitialContext);

                        var s = jassa.rdf.NodeFactory.createUri(pm.expandPrefix(scope.rexSubject));
                        var p = jassa.rdf.NodeFactory.createUri(pm.expandPrefix(scope.rexNavPredicate));

                        var triples = array.map(function(item) {
                            var o = jassa.rdf.NodeFactory.createUri(pm.expandPrefix(item));
                            var r = scope.rexNavInverse
                                ? new jassa.rdf.Triple(o, p, s)
                                : new jassa.rdf.Triple(s, p, o)
                                ;

                            return r;
                        });

                        // TODO: We must check whether that triple already exists, and if it does not, insert it
                        //jassa.io.TalisRdfJsonUtils.triplesToTalisRdfJson(triples, scope.rexContext.override);

                        // Notify the context about the triples which we require to exist
                        slot.triples = triples;
                    };

                    // TODO Check for changes in the target array, and update
                    // relations as needed

                    // ISSUE: We need to ensure that each IRI in the array has the appropriate relation to
                    // the source resource of the navigation
                    scope.$watchCollection(targetModelStr, function(array) {
                        if(array) {
                            updateRelation(array);
                        }
                    });

                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 *
 * rexObject takes an index to reference an object in a (conceptual) array under a given subject and predicate
 *
 * Hm, no, I still think we can do better: There are different ways to refer to a specific object:
 * - by index (the 3nd item under leipzig -> rdfs:label (possibly of a certain datatype and lang)
 * - by value (i am referring to the triple having leipzig -> population -> 500000)
 *   yet, we could generalize a value reference  to an index reference:
 *      the first object satisfying "leipzig -> population -> {value: 500000 }"
 *
 * So long story short: this directive references an item in regard to a set of filters.
 *
 *
 * TODO Update below
 *
 * Note that this directive only creates a context for setting components
 * (term type, value, datatype and language tag) of an object -
 * it does not create an rdf.Node object directly.
 *
 * rex-object="{}" // someObject
 * The argument is optional.
 *
 * If one is provided, it is as a reference to an object being built, otherwise
 * a new object is allocated.
 * The provided object is registered at the object for the
 * corresponding predicate and subject in the context where it is used.
 *
 * Note that this means that in principle several triples being built could reference
 * the state of the same object (even if they are built using different rex-contexts).
 */
.directive('rexObject', ['$parse', function($parse) {
    return {
        priority: 13,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexPredicate'],
        controller: angular.noop,
        compile: function(ele, attrs) {

//            var modelExprStr = ele.attr('rex-object');
//            if(!modelExprStr) {
//                ele.attr('rex-object')
//            }
//
//            // TODO Raise an error if rex-predicate exists on this element
//            //if(ele.attr)
//
//            ele.removeAttr('rex-typeof');
//
//            ele.attr('rex-predicate', '"http://www.w3.org/1999/02/22-rdf-syntax-ns#type"');
//            ele.attr('rex-iri', modelExprStr);


            return {
                pre: function(scope, ele, attrs, ctrls) {
                    var predicateCtrl = ctrls[1];
                    var contextCtrl = ctrls[0];

                    var i = predicateCtrl.rexObjectScopes.length;
                    if(!attrs['rexObject']) {
                        attrs['rexObject'] = '' + i;
                    }


                    //console.log('FOOO', attrs);

//console.log('rexObject index: ' + i);
                    predicateCtrl.rexObjectScopes.push(scope);

                    syncAttr($parse, scope, attrs, 'rexObject');

//                    scope.$watch('rexObject', function(newVal) {
//                        console.log('rexObject is: ', newVal, typeof newVal);
//                    })

                    scope.$on('$destroy', function() {
                        jassa.util.ArrayUtils.removeItemStrict(predicateCtrl.rexObjectScopes, scope);
                    });



                    // If rexObject is present, we also create a rexRef attribute
                    var rexRef = function() {
                        var result = {
                            s: scope.rexSubject,
                            p: scope.rexPredicate,
                            i: scope.rexObject
                        };

                        return result;
                    };

                    scope.$watch(function() {
                        var r = rexRef();
                        return r;
                    }, function(newRef) {
                        scope.rexRef = newRef;
                    }, true);

                    scope.rexRef = rexRef();


                    // Below stuff is deprecated
                    // Make the prefixes part of the Talis RDF json object
                    //var cc = createCompileComponent('rexPrefixMapping', 'prefixMapping', $parse, true);
                    //cc.pre(scope, ele, attrs, ctrls);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexPredicate', ['$parse', function($parse) {
    return {
        priority: 17,
        restrict: 'A',
        scope: true,
        //require: ['^?rexSubject', '^?rexObject']
        controller: ['$scope', function($scope) {
            this.rexObjectScopes = $scope.rexObjectScopes = [];
        }],
        compile: function(ele, attrs){
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    syncAttr($parse, scope, attrs, 'rexPredicate');
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * Prefixes
 *
 * prefixes must be declared together with the context and cannot be nested
 *
 */
.directive('rexPrefix', ['$parse', function($parse) {
    return {
        priority: 19,
        restrict: 'A',
        scope: true,
        //require: '^rexContext',
        require: 'rexContext',
        controller: ['$scope', function($scope) {
            $scope.rexPrefix = $scope.rexPrefix || {};
        }],
        compile: function(ele, attrs) {

            setEleAttrDefaultValue(ele, attrs, 'rex-prefix', 'rexPrefix');

            return {
                pre: function(scope, ele, attrs, ctrls) {

                    var processPrefixDecls = function(val) {
                        // Set up a prototype chain to an existing
                        // prefix mapping
                        var parentRexPrefix = scope.$parent.rexPrefix;
                        var parentPrefixes = parentRexPrefix ? parentRexPrefix.prefixes : jassa.vocab.InitialContext;

                        var result;
                        if(parentPrefixes) {
                            result = Object.create(parentPrefixes);
                        } else {
                            result = {};
                        }

                        var obj = jassa.util.PrefixUtils.parsePrefixDecls(val);
                        angular.extend(result, obj);
//                        var keys = Object.keys(obj);
//                        keys.forEach(function(key) {
//                            result[key] = obj[key];
//                        });

                        return result;
                    };

                    syncAttr($parse, scope, attrs, 'rexPrefix', true, processPrefixDecls);

                    // TODO We may need to watch scope.$parent.rexPrefix as well

                    var updatePrefixMapping = function() {
//                        for(var key in scope.rexPrefix) {
//                            console.log('GOT: ', key);
//                        }

                        scope.rexPrefixMapping = new jassa.rdf.PrefixMappingImpl(scope.rexPrefix);

                        scope.rexContext.prefixMapping = scope.rexPrefixMapping;
                    };

                    // Update the prefixMapping when the prefixes change
                    scope.$watchGroup([function() {
                        return scope.rexPrefix;
                    }, function() {
                        return scope.rexContext;
                    }],
                    function(rexPrefix) {
                        updatePrefixMapping();
                    }, true);

                    updatePrefixMapping();
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexSparqlService', ['$parse', function($parse) {
    return {
        priority: 30,
        restrict: 'A',
        scope: true,
        controller: angular.noop,
        compile: function(ele, attrs){
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    syncAttr($parse, scope, attrs, 'rexSparqlService');
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexSubject', ['$parse', '$q', function($parse, $q) {
    return {
        priority: 24,
        restrict: 'A',
        scope: true,
        require: '^rexContext',
        controller: angular.noop,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, contextCtrl) {

                    var subjectUri = syncAttr($parse, scope, attrs, 'rexSubject');

                    var doPrefetch = function() {
                        //console.log('doPrefetch');

                        var sparqlService = scope.rexSparqlService;
                        var lookupEnabled = scope.rexLookup;
                        var subjectUri = scope.rexSubject;

                        //if(lookupFn && angular.isFunction(lookupFn) && subjectUri) {
                        if(lookupEnabled && sparqlService && subjectUri) {

                            var pm = scope.rexPrefixMapping;
                            var uri = pm ? pm.expandPrefix(subjectUri) : subjectUri;

                            var s = jassa.rdf.NodeFactory.createUri(uri);


                            var promise = jassa.service.ServiceUtils.execDescribeViaSelect(sparqlService, [s]);


                            //var promise = scope.rexLookup(s);
                            $q.when(promise).then(function(graph) {
                                var contextScope = contextCtrl.$scope.rexContext;
                                var baseGraph = contextScope.baseGraph = contextScope.baseGraph || new jassa.rdf.GraphImpl();

                                contextScope.baseGraph.addAll(graph);
                                // TODO Add the data to the context
                            });
                        }

//                        $q.when(scope.rexContext.prefetch(s)).then(function() {
//                            // make sure to apply the scope
//                        });
                    };

                    scope.$watchGroup([
                        function() {
                            return scope.rexLookup;
                        }, function() {
                            return scope.rexSubject;
                        }, function() {
                            return scope.rexPrefixMapping;
                        }
                    ], function() {
                        doPrefetch();
                    });

//                    scope.$watch(function() {
//                        return scope.rexSubject;
//                    }, function(newVal) {
//                        doPrefetch();
//                    });
//
//                    scope.$watch(function() {
//                        return scope.rexPrefixMapping;
//                    }, function(pm) {
//                        doPrefetch();
//                    });
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * TODO: Actually we should just implement this as a convenience directive which replaces itself with
 * rex-termtype rex-value rex-lang and rex-datatype
 * This way we wouldn't have to make the book keeping more complex than it already is
 *
 * rexTerm synchronizes a model which is interpreted as an object in a talis RDF json and
 * thus provides the fields 'type', 'value', 'datatype' and 'lang'.
 *
 * <rdf-term-input ng-model="model" rex-term="model"></rdf-term-input>
 *
 * If rex-term appears on a directive using a model attribute   , it can be shortened as shown below:
 *
 * <rdf-term-input ng-model="model" rex-term></rdf-term-input>
 *
 *
 */
.directive('rexTerm', ['$parse', function($parse) {
    return {
        priority: 11,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexObject'],
        controller: angular.noop,
        compile: function(ele, attrs) {
            throw new Error('rex-term is not implemented yet');
            //return createCompileComponent('rexValue', 'value', $parse);
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexTermtype', ['$parse', function($parse) {
    return {
        priority: 10,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexObject', '?ngModel'],
        controller: angular.noop,
        compile: function(ele, attrs) {
            return createCompileComponent('rexTermtype', 'type', $parse);
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * Convenience directive
 *
 * implies rex-prediacte="rdf:type" rex-iri
 *
 * !! Important: because rex-predicate is implied, this directive cannot be used on a directive
 * that already hase rex-predicate defined !!
 */
.directive('rexTypeof', ['$parse', '$compile', function($parse, $compile) {
    return {
        priority: 1000,
        restrict: 'A',
        scope: true,
        terminal: true,
        controller: angular.noop,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    var modelExprStr = ele.attr('rex-typeof');

                    // TODO Raise an error if rex-predicate exists on this element
                    //if(ele.attr)

                    ele.removeAttr('rex-typeof');

                    ele.attr('rex-predicate', '"http://www.w3.org/1999/02/22-rdf-syntax-ns#type"');
                    ele.attr('rex-iri', modelExprStr);

                    // Continue processing any further directives
                    $compile(ele)(scope);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexValue', ['$parse', function($parse) {
    return {
        priority: 4,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexObject', '?ngModel'],
        controller: angular.noop,
        compile: function(ele, attrs) {
            return createCompileComponent('rexValue', 'value', $parse);
        }
    };
}])

;


// Updates a target model based on transformation whenever the source changes
var syncHelper = function(scope, attrs, $parse, $interpolate, sourceAttr, targetAttr, fnAttr, conditionAttr, iterpolateSource) {

    // TODO Instead of $interpolate we could actually use attrs.$observe()

    var sourceExprStr = attrs[sourceAttr];
    var sourceGetter = iterpolateSource ? $interpolate(sourceExprStr) : $parse(sourceExprStr);

    var targetExprStr = attrs[targetAttr];
    var targetGetter = $parse(targetExprStr);
    var targetSetter = targetGetter.assign;

    var fnExprStr = attrs[fnAttr];
    var fnGetter = $parse(fnExprStr);

    var identity = function(x) {
        return x;
    };


    var conditionExprStr = attrs[conditionAttr];
    var conditionGetter = $parse(conditionExprStr);

    var checkCondition = function() {
        var tmp = conditionGetter(scope);
        var result = angular.isUndefined(tmp) ? true : tmp;
        return result;
    };

    var doSync = function() {
        var isConditionSatisfied = checkCondition();
        if(isConditionSatisfied) {
            var sourceValue = sourceGetter(scope);
            var fn = fnGetter(scope) || identity;
            var v = fn(sourceValue);
            targetSetter(scope, v);
        }
    };

    // If the condition changes to 'true', resync the models
    scope.$watch(function() {
        var r = checkCondition();
        return r;
    }, function(isConditionSatisfied) {
        if(isConditionSatisfied) {
            doSync();
        }
    }); // Condition should be boolean - no need for deep watch

    scope.$watch(function() {
        var r = fnGetter(scope);
        return r;
    }, function(newFn) {
        if(newFn) {
            doSync();
        }
    }); // Functions are compared by reference - no need to deep watch

    scope.$watch(function() {
        var r = sourceGetter(scope);
        return r;
    }, function(sourceValue) {
        doSync();
    }, true);

};

angular.module('ui.jassa.sync', []);

angular.module('ui.jassa.sync')

/**
 * Convenience directive
 *
 * sync-template="templateStr"
 *
 * implies sync-source="templateStr" sync-interpolate sync-to-target? sync-target?
 *
 * if sync-target is not specified, it will try to detect a target based on model attribute names (e.g. ngModel)
 */
.directive('syncTemplate', ['$parse', '$compile', function($parse, $compile) {
    return {
        priority: 1000,
        restrict: 'A',
        scope: true,
        terminal: true,
        controller: function() {},
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    var templateStr = ele.attr('sync-template');

                    ele.removeAttr('sync-template');

                    ele.attr('sync-source', templateStr);
                    ele.attr('sync-source-interpolate', '');

                    if(ele.attr('sync-target') == null) {
                        var name = getModelAttribute(attrs);
                        var modelExprStr = attrs[name];

                        if(!modelExprStr) {
                            throw new Error('No model provided and found');
                        }

                        ele.attr('sync-target', modelExprStr);
                    }

                    // TODO Create a function to set attr default values
                    if(ele.attr('sync-to-target') == null) {
                        ele.attr('sync-to-target', '');
                    }

                    // Continue processing any further directives
                    $compile(ele)(scope);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.sync')

.directive('syncToSource', ['$parse', '$interpolate', function($parse, $interpolate) {
    return {
        priority: 390,
        restrict: 'A',
        //scope: true,
        controller: function() {},
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    syncHelper(scope, attrs, $parse, $interpolate, 'syncTarget', 'syncSource', 'syncToSource', 'syncToSourceCond', false);
                }
            };
        }
    };
}])

;


angular.module('ui.jassa.sync')

// sync-to-target="toString"
.directive('syncToTarget', ['$parse', '$interpolate', function($parse, $interpolate) {
    return {
        priority: 390,
        restrict: 'A',
        //scope: true,
        controller: function() {},
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {

                    var interpolateSource = 'syncSourceInterpolate' in attrs;

                    syncHelper(scope, attrs, $parse, $interpolate, 'syncSource', 'syncTarget', 'syncToTarget', 'syncToTargetCond', interpolateSource);
                }
            };
        }
    };
}])

;
