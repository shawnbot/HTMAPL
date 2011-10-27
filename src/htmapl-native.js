var HTMAPL = {};

(function() {

    try {
        var mm = com.modestmaps;
    } catch (e) {
        throw "Couldn't find com.modestmaps; did you include modestmaps.js?";
        return false;
    }

    HTMAPL.Map = function(element, options) {
        this.element = element;
        this.initialize(options);
    };

    HTMAPL.Map.defaults = {
        "center":       {lat: 37.764, lon: -122.419},
        "zoom":         17,
        "interactive":  true,
        "provider":     "toner",
        "layers":       ".layer",
        "markers":      ".marker"
    };

    HTMAPL.Map.prototype = {
        initialize: function(overrides) {
            var options = {};
            extend(options, HTMAPL.Map.defaults, overrides);

            this.updateOptions(options, this.element);

            var handlers = [];
            if (options.interactive) {
                handlers.push(new mm.MouseHandler());
            }

            var map = this.map = new mm.Map(this.element, NULL_PROVIDER, null, handlers);
            this.element.__htmapl__ = {map: map};
            // console.log("+ map:", map);

            if (options.provider) {
                // console.log("  * base provider:", options.provider);
                var baseLayer = map.layers[0];
                baseLayer.setProvider(options.provider);
                this.element.insertBefore(baseLayer.parent, this.element.firstChild);
                // XXX: force the base map layer to the bottom
                baseLayer.parent.style.zIndex = 0;
            }

            if (options.layers) {
                this.initLayers(options.layers);
            }

            if (options.markers) {
                this.initMarkers(options.markers);
            }

            this.applyOptions(options);
        },

        initMarkers: function(filter) {
            var markers = getChildren(this.element, filter);
            // console.log("markers:", markers);
            if (markers.length) {
                var div = document.createElement("div"),
                    markerLayer = new mm.MarkerLayer(this.map, NULL_PROVIDER, div);
                addLayerMarkers(markerLayer, markers);
                this.element.__htmapl__.markers = markerLayer;
                return markerLayer;
            }
            return null;
        },

        initLayers: function(filter) {
            var children = getChildren(this.element, filter),
                len = children.length;
            for (var i = 0; i < len; i++) {
                var layer = children[i];
                    type = getData(layer, "type") || "image",
                    provider = getData(layer, "provider");

                // console.log("  + layer:", type, layer);

                var map = this.map,
                    mapLayer;
                switch (type.toLowerCase()) {
                    case "markers":
                        // marker layers ignore the provider
                        mapLayer = new mm.MarkerLayer(map, NULL_PROVIDER, layer);
                        addLayerMarkers(mapLayer, getChildren(layer));
                        break;

                    case "geojson":
                        var url = getData(layer, "url") || provider,
                            template = getData(layer, "template"),
                            tiled = url && url.match(/{(Z|X|Y)}/);

                        // console.log("template:", template);

                        var buildMarker;
                        switch (typeof template) {
                            case "function":
                                buildMarker = template;
                                break;
                            case "string":
                                buildMarker = getBuildMarker(template);
                                break;
                        }

                        // console.log("buildMarker:", buildMarker);

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
                                    "dataType": getData(layer, "url_type") || "jsonp"
                                };

                                var autoExtent = getData(layer, "set_extent") === "true";
                                // console.log("auto-extent?", autoExtent, layer);

                                layerOptions.success = function(collection) {
                                    var features = collection.features,
                                        len = features.length,
                                        locations = [];
                                    for (var i = 0; i < len; i++) {
                                        var feature = features[i],
                                            marker = buildMarker.call(mapLayer, feature);
                                        mapLayer.addMarker(marker, feature);
                                        locations.push(marker.location);
                                    }
                                    // TODO: trigger a load event

                                    if (locations.length && autoExtent) {
                                        // console.log("auto-extent:", locations);
                                        map.setExtent(locations);
                                    }
                                };

                                // TODO: use something else to load?
                                $.ajax(url, layerOptions);
                            }
                        }
                        break;
                        
                    case "image":
                        var mapProvider = getProvider(provider);
                        mapLayer = new mm.Layer(map, mapProvider, layer);
                        break;
                }

                if (mapLayer) {
                    map.layers.push(mapLayer);
                    layer.__htmapl__ = {layer: mapLayer};
                } else {
                    console.warn("no provider created for layer of type", type, ":", layer);
                }
            }
        },

        updateOptions: function(options, element) {
            var DATA_KEYS = {
                "center":       getLatLon,
                "zoom":         getInt,
                "extent":       getExtent,
                "provider":     getProvider,
                "zoomRange":    getArray,
                "interactive":  getBoolean,
                "markers":      String
            };
            for (var key in DATA_KEYS) {
                var value = getData(element, key) || options[key];
                // if it's a string, parse it
                if (typeof value === "string") {
                    options[key] = DATA_KEYS[key].call(element, value);
                // if it's not undefined, assign it
                } else if (typeof value !== "undefined") {
                    options[key] = value;
                } else {
                    // console.info("invalid value for", key, ":", value);
                }
            }
        },

        applyOptions: function(options) {
            // and kick things off by setting the extent, center and zoom
            if (options.extent) {
                this.map.setExtent(options.extent);
            } else if (options.center) {
                this.map.setCenter(options.center);
            }
            if (!isNaN(options.zoom)) {
                this.map.setZoom(options.zoom);
            }
        }
    };

    HTMAPL.makeMap = function(element, options) {
        return new HTMAPL.Map(element, options);
    };

    HTMAPL.makeMaps = function(elements, options) {
        var maps = [],
            len = elements.length;
        for (var i = 0; i < len; i++) {
            maps.push(new HTMAPL.Map(elements[i], options));
        }
        return maps;
    };

    function extend(dest, sources) {
        var argc = arguments.length - 1;
        for (var i = 1; i < argc; i++) {
            var source = arguments[i];
            if (!source) continue;
            for (var p in source) {
                dest[p] = source[p];
            }
        }
    }

    function getChildren(element, filter) {
        var children = element.childNodes,
            len = children.length,
            matched = [];

        // TODO: just use Sizzle?
        switch (typeof filter) {
            case "string":
                if (filter.length > 1 && filter.charAt(0) === ".") {
                    var className = filter.substr(1),
                        pattern = new RegExp("\\b" + className + "\\b");
                    filter = function(child) {
                        return child.className && child.className.match(pattern);
                    };
                } else {
                    // TODO: some other filter here? filter by selector?
                    console.warn("ignoring filter:", filter);
                    filter = null;
                }
                break;
            case "function":
                // legit
                break;
            default:
                console.warn("invalid filter:", filter);
                filter = null;
                break;
        }

        for (var i = 0; i < len; i++) {
            var child = children[i];
            if (!filter || filter.call(this, child)) {
                matched.push(child);
            }
        }
        return matched;
    }

    function getData(element, key) {
        if (element.hasOwnProperty("dataset")) {
            // console.log("looking for data:", [key], "in", element.dataset);
            return element.dataset[key] || element.getAttribute("data-" + key);
        } else {
            return element.getAttribute("data-" + key);
        }
    }

    function setData(element, key, value) {
        if (!element.hasOwnProperty("dataset")) {
            element.dataset = {};
        }
        element.dataset[key] = value;
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
    /**
     * Register a named map tile provider. Basic usage:
     *
     * $.fn.htmapl.registerProvider("name", new com.modestmaps.MapProvider(...));
     *
     * You can also register tile provider "generator" prefixes with a colon
     * between the prefix and the generator argument(s). E.g.:
     *
     * $.fn.htmapl.registerProvider("prefix:layer", function(layer) {
     *     var url = "path/to/" + layer + "/{Z}/{X}/{Y}.png";
     *     return new com.modestmaps.TemplatedMapProvider(url);
     * });
     */
    function registerProvider(name, provider) {
        PROVIDERS[name] = provider;
    }

    /**
     * Get a named provider
     */
    function getProvider(str) {
        if (str in PROVIDERS) {
            return PROVIDERS[str];
        } else if (str.indexOf(":") > -1) {
            var parts = str.split(":"),
                prefix = parts.shift();
            if (prefix in PROVIDERS) {
                return PROVIDERS[prefix].apply(null, parts);
            }
        } else {
            return url
                ? new mm.TemplatedMapProvider(url)
                : NULL_PROVIDER;
        }
    }

    /**
     * Built-in providers
     */
    var NULL_PROVIDER = new mm.MapProvider(function(c) { return null; });
    registerProvider("none",        NULL_PROVIDER);
    // TODO: turn bing into a prefix provider (road, aerial, etc.)
    registerProvider("bing",        new mm.TemplatedMapProvider("http://ecn.t{S:0,1,2}.tiles.virtualearth.net/tiles/r{Q}?g=689&mkt=en-us&lbl=l1&stl=h&shading=hill"));
    registerProvider("toner",       new mm.TemplatedMapProvider("http://spaceclaw.stamen.com/toner/{Z}/{X}/{Y}.png"));

    /**
     * Cloudmade style map provider generator.
     */
    PROVIDERS["cloudmade"] = (function() {
        var aliases = {
            "fresh":    997,
            "paledawn": 998,
            "midnight": 999
        };

        var CM = function(styleId) {
            if (styleId in aliases) {
                styleId = aliases[styleId];
            }
            return new mm.TemplatedMapProvider([
                "http://{S}tile.cloudmade.com",
                CM.key,
                styleId,
                "256/{Z}/{X}/{Y}.png"
            ].join("/"), CM.domains);
        };

        CM.key = "1a1b06b230af4efdbb989ea99e9841af";
        CM.domains = ["a.", "b.", "c.", ""];
        CM.registerAlias = function(alias, styleId) {
            aliases[alias] = styleId;
        };

        return CM;
    })();

    /**
     * Acetate layer generator
     */
    PROVIDERS["acetate"] = function(layer) {
        return new mm.TemplatedMapProvider("http://acetate.geoiq.com/tiles/acetate-" + layer + "/{Z}/{X}/{Y}.png");
    };

    /**
     * Adds each marker element in a jQuery selection to the provided
     * ModestMaps Layer. Each marker element should have a "location" data
     * that getLatLon() can parse into a Location object.
     *
     * Returns the number of markers added with valid locations.
     */
    function addLayerMarkers(layer, markers) {
        var added = 0,
            len = markers.length;
        for (var i = 0; i < len; i++) {
            var marker = markers[i],
                rawLocation = getData(marker, "location"),
                parsedLocation = getLatLon(rawLocation);
            if (parsedLocation) {
                layer.addMarker(marker, parsedLocation);
                added++;
            } else {
                console.warn("invalid marker location:", rawLocation, "; skipping marker:", marker);
            }
        }
        return added;
    }

    /**
     * Get a marker building function. If the first character of the provided
     * name is "#", the string is assumed to refer to a jQuery template with
     * the name as its id selector.
     *
     * Otherwise, we attempt to find a function in the window's scope with that
     * name. We're using eval() here now, which is obviously bad, but this
     * could be modified to safely parse dotted variable references, such as
     * "SomeClass.prototype.buildMarker".
     *
     * Either way, the return value should be a function, or null if nothing
     * was found.
     */
    function getBuildMarker(name) {
        // TODO: remove jQuery dependency here?
        // TODO: support Mustache templates? something else?
        if (name.charAt(0) === "#") {
            var target = document.getElementById(name.substr(1));
            if (target) {
                var template = $(target).template();
                return function(feature) {
                    return $.tmpl(template, feature).get(0);
                };
            } else {
                return null;
            }
        } else {
            try {
                var ref;
                with (window) {
                    ref = eval(name);
                }
                if (typeof ref === "function") {
                    return ref;
                }
            } catch (e) {
                console.warn("unable to eval('" + name + "'):", e);
            }
            return null;
        }
    }

    var exports;
    if (typeof $ !== "undefined") {
        // keep a reference around to the plugin object for exporting useful functions
        exports = $.fn.htmapl = function(options) {
            return this.each(function() {
                var $this = $(this),
                    htmapl = $(this).data("htmapl");
                if (htmapl) {
                    htmapl.applyOptions(options);
                } else {
                    try {
                        htmapl = HTMAPL.makeMap(this, options);
                        var layers = htmapl.map.layers,
                            len = layers.length;
                        for (var i = 0; i < len; i++) {
                            $(layers[i].parent).data("layer", layers[i]);
                        }
                    } catch (e) {
                        console.error(e);
                    }
                    $this.data("htmapl", htmapl);
                }
            });
        };
    } else {

        exports = HTMAPL;

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
    }

})();