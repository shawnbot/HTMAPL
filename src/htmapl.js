(function(window, $) {

    try {
        var mm = com.modestmaps;
    } catch (e) {
        throw "Couldn't find com.modestmaps; did you include modestmaps.js?";
        return false;
    }

 	/**
	 * Parses mustached "variables" in a string and replaces them with property
	 * values from another object. E.g.:
	 *
	 * templatize("Type: {type}", {type: "fish"}) -> "Type: fish"
	 */
 	function templatize(template, obj) {
		return template.replace(/{([^}]+)}/g, function(s, prop) {
			return obj[prop] || "";
		});
	}

	/**
	 * Parsing Functions
	 *
	 * The following functions are used to parse meaningful values from strings,
	 * and should return null if the provided strings don't match a predefined
	 * format.
	 */

	/**
	 * Parse a {lat,lon} object from a string: "lat,lon", or return null if the
	 * string does not contain a single comma.
	 */
 	function getLatLon(str) {
		if (typeof str === "string" && str.indexOf(",") > -1) {
			var parts = str.split(/\s*,\s*/),
                lat = parseFloat(parts[0]),
                lon = parseFloat(parts[1]);
			return {lon: lon, lat: lat};
		}
		return null;
	}

	/**
	 * Parse an {x,y} object from a string: "x,x", or return null if the string
	 * does not contain a single comma.
	 */
 	function getXY(str) {
		if (typeof str === "string" && str.indexOf(",") > -1) {
			var parts = str.split(/\s*,\s*/),
                x = parseInt(parts[0]),
                y = parseInt(parts[1]);
			return {x: x, y: y};
		}
		return null;
	}

	/**
	 * Parse an extent array [{lat,lon},{lat,lon}] from a string:
	 * "lat1,lon1,lat2,lon2", or return null if the string does not contain a
	 * 4 comma-separated numbers.
	 */
 	function getExtent(str) {
		if (typeof str === "string" && str.indexOf(",") > -1) {
			var parts = str.split(/\s*,\s*/);
			if (parts.length == 4) {
				var lat1 = parseFloat(parts[0]),
                    lon1 = parseFloat(parts[1]),
                    lat2 = parseFloat(parts[2]),
                    lon2 = parseFloat(parts[3]);
                return [{lon: Math.min(lon1, lon2),
                         lat: Math.max(lat1, lat2)},
                        {lon: Math.max(lon1, lon2),
                         lat: Math.min(lat1, lat2)}];
			}
		}
		return null;
	}

	/**
	 * Parse an integer from a string using parseInt(), or return null if the
	 * resulting value is NaN.
	 */
	function getInt(str) {
		var i = parseInt(str);
		return isNaN(i) ? null : i;
	}

	/**
	 * Parse a float from a string using parseFloat(), or return null if the
	 * resulting value is NaN.
	 */
	function getFloat(str) {
		var i = parseFloat(str);
		return isNaN(i) ? null : i;
	}

	/**
	 * Parse a string as a boolean "true" or "false", otherwise null.
	 */
	function getBoolean(str) {
		return (str === "true") ? true : (str === "false") ? false : null;
	}

	/**
	 * Parse a string as an array of at least two comma-separated strings, or
	 * null if it does not contain at least one comma.
	 */
	function getArray(str) {
		return (typeof str === "string" && str.indexOf(",") > -1) ? str.split(",") : null;
	}

    /**
     * CSS pixel value converter.
     */
	function px(n) {
		return ~~(0.5 + n) + "px";
	}

    var PROVIDERS = {};
    function registerProvider(name, provider) {
        PROVIDERS[name] = provider;
    }

    /**
     * Cloudmade style map provider generator.
     */
    var cloudmade = function(styleId) {
        return new mm.TemplatedMapProvider(["http://{S}.tile.cloudmade.com", cloudmade.key, styleId, "{Z}/{X}/{Y}.png"].join("/"), cloudmade.domains);
    }
    cloudmade.key = "BC9A493B41014CAABB98F0471D759707";
    cloudmade.domains = ["a", "b", "c"];

    var acetate = function(layer) {
        return new mm.TemplatedMapProvider("http://acetate.geoiq.com/tiles/acetate-" + layer + "/{Z}/{X}/{Y}.png");
    };

    /**
     * Built-in providers
     */
    var NULL_PROVIDER = new mm.MapProvider(function(c) { return null; });
    registerProvider("none",                NULL_PROVIDER);
    registerProvider("toner",               new mm.TemplatedMapProvider("http://spaceclaw.stamen.com/toner/{Z}/{X}/{Y}.png"));
    registerProvider("bing",                new mm.TemplatedMapProvider("http://ecn.t{S:0,1,2}.tiles.virtualearth.net/tiles/r{Q}?g=689&mkt=en-us&lbl=l1&stl=h&shading=hill"));
    registerProvider("acetate:roads",       acetate("roads"));
    registerProvider("acetate:labels",      acetate("labels"));
    registerProvider("cloudmade:paledawn",  cloudmade(997));
    registerProvider("cloudmade:fresh",     cloudmade(998));
    registerProvider("cloudmade:midnight",  cloudmade(999));

    /**
     * Get a named provider
     */
    function getProvider(url) {
        if (url in PROVIDERS) {
            return PROVIDERS[url];
        } else {
            return url
                ? new mm.TemplatedMapProvider(url)
                : NULL_PROVIDER;
        }
    }

    function addLayerMarkers(layer, $markers) {
        $markers.each(function(i, marker) {
            var rawLocation = $(marker).data("location"),
                parsedLocation = getLatLon(rawLocation);
            if (parsedLocation) {
                layer.addMarker(marker, parsedLocation);
            } else {
                console.warn("invalid marker location:", rawLocation, "; skipping marker:", marker);
            }
        });
    }

    function loadLayerMarkers($layer, url, options) {
        if (!options) options = {};
        $.extend(options, {
            success: function(collection) {
                $
            }
        });
        return $.ajax(url, options);
    }

	// keep a reference around to the plugin object for exporting useful functions
	var exports = $.fn.htmapl = function(options) {
		return this.each(function() {
			htmapl(this, options);
		});
	};

	// exports
    exports.providers = PROVIDERS;
    exports.registerProvider = registerProvider;
    exports.getProvider = getProvider;
	exports.getArray = getArray;
	exports.getBoolean = getBoolean;
	exports.getExtent = getExtent;
	exports.getFloat = getFloat;
	exports.getInt = getInt;
	exports.getLatLon = getLatLon;
	exports.getXY = getXY;
	exports.templatize = templatize;

    var DATA_KEYS = {
        "center":       getLatLon,
        "zoom":         getInt,
        "extent":       getExtent,
        "provider":     getProvider,
        "zoomRange":    getArray,
        "interactive":  getBoolean,
        "markers":      String
    };

    var DATA_DEFAULTS = exports.defaults = {
        "center":       {lat: 37.764, lon: -122.419},
        "zoom":         17,
        "interactive":  true,
        "provider":     "bing",
        "layers":       ".layer",
        "markers":      ".marker"
    };

    function htmapl(container, overrides) {
        var $container = $(container);

        var options = {};
        $.extend(options, DATA_DEFAULTS, overrides);

        for (var key in DATA_KEYS) {
            var value = $container.data(key) || options[key];
            // if it's a string, parse it
            if (typeof value === "string") {
                options[key] = DATA_KEYS[key].call(container, value);
            // if it's not undefined, assign it
            } else if (typeof value !== "undefined") {
                options[key] = value;
            } else {
                // console.info("invalid value for", key, ":", value);
            }
        }

        // console.log("+ map options:", options);

        var handlers = [];
        if (options.interactive) {
            handlers.push(new mm.MouseHandler());
        }

        var map = new mm.Map(container, NULL_PROVIDER, null, handlers);
        // console.log("+ map:", map);

        if (options.provider) {
            // console.log("  * base provider:", options.provider);
            var baseLayer = map.layers[0];
            baseLayer.setProvider(options.provider);
            container.insertBefore(baseLayer.parent, container.firstChild);
            // XXX: force the base map layer to the bottom
            baseLayer.parent.style.zIndex = 0;
        }

        if (options.layers) {
            var layers = $container.children(options.layers);
            if (layers.length) {
                layers.each(function(i, layer) {
                    var $layer = $(layer),
                        type = $layer.data("type"),
                        provider = $layer.data("provider");

                    // console.log("  + layer:", type, layer);

                    var mapLayer;
                    switch (type.toLowerCase()) {
                        case "markers":
                            // marker layers ignore the provider
                            mapLayer = new mm.MarkerLayer(map, NULL_PROVIDER, layer);
                            addLayerMarkers(mapLayer, $layer.children());
                            break;

                        case "geojson":
                            var url = $layer.data("url") || provider,
                                template = $layer.data("template"),
                                tiled = url && url.match(/{(Z|X|Y)}/);

                            var buildMarker;
                            switch (typeof template) {
                                case "function":
                                    buildMarker = template;
                                    break;
                                case "string":
                                    buildMarker = getTemplateMaker(template);
                                    break;
                            }

                            // XXX: two very different things happen here
                            // depending on whether the data is "tiled":
                            if (tiled) {

                                // if so, we use a GeoJSONProvider and a tiled
                                // layer...
                                var tileProvider = getProvider(url);
                                mapProvider = new mm.GeoJSONProvider(tileProvider, buildMarker);
                                mapLayer = new mm.Layer(map, mapProvider, layer);

                            } else {

                                // otherwise we create a MarkerLayer, load
                                // data, and add markers on success.
                                mapLayer = new mm.MarkerLayer(map, NULL_PROVIDER, layer);
                                if (url) {
                                    var layerOptions = {
                                        // the default data type is JSON-P
                                        "dataType": "jsonp"
                                    };

                                    var autoExtent = $layer.data("set-extent");
                                    // console.log("auto-extent?", autoExtent);

                                    // TODO: allow overriding $.ajax options?
                                    layerOptions.success = function(collection) {
                                        var features = collection.features,
                                            len = features.length,
                                            locations = [];
                                        for (var i = 0; i < len; i++) {
                                            var feature = features[i],
                                                marker = mapLayer.buildMarker(feature);
                                            mapLayer.addMarker(marker, feature);
                                            locations.push(marker.location);
                                        }
                                        // forget the request
                                        $layer.data("htmapl.request", null);
                                        // trigger a load event
                                        $layer.trigger("htmapl.load", collection);

                                        if (locations.length && autoExtent) {
                                            // console.log("auto-extent:", locations);
                                            map.setExtent(locations);
                                        }
                                    };

                                    var request = $.ajax(url, layerOptions);
                                    $layer.data("htmapl.request", request);
                                }

                            }
                            break;
                            
                        case "image":
                        default:
                            var mapProvider = getProvider(provider);
                            mapLayer = new mm.Layer(map, mapProvider, layer);
                            break;
                    }

                    if (mapLayer) {
                        map.layers.push(mapLayer);
                        $layer.data("htmapl.layer", mapLayer);
                    } else {
                        console.warn("no provider created for layer of type", type, ":", layer);
                    }
                });
            }
        }

        if (options.markers) {
            var markers = $container.children(options.markers);
            if (markers.length) {
                var div = document.createElement("div"),
                    markerLayer = new mm.MarkerLayer(map, NULL_PROVIDER, div);
                addLayerMarkers(markerLayer, markers);
                $container.data("htmapl.markers", markerLayer);
            }
        }

        // set up event handlers
        map.addCallback("drawn", function(map) {
            $container.trigger("htmapl.drawn");
        });

        map.addCallback("panned", function(map, delta) {
            $container.trigger("htmapl.panned", delta);
        });

        map.addCallback("zoomed", function(map, offset) {
            $container.trigger("htmapl.zoomed", offset);
        });

        map.addCallback("centered", function(map, center) {
            $container.trigger("htmapl.centered", center);
        });

        map.addCallback("extentset", function(map, locations) {
            $container.trigger("htmapl.extentset", locations);
        });

        // and kick things off by setting the extent, center and zoom
        if (options.extent) {
            map.setExtent(options.extent);
        } else if (options.center) {
            map.setCenter(options.center);
        }
        if (!isNaN(options.zoom)) {
            map.setZoom(options.zoom);
        }

        $container.data("htmapl.map", map);

        return map;
    }


})(window, jQuery);
