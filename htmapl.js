if (typeof HTMAPL === "undefined") var HTMAPL = {};
(function() {

    // TODO: include minified (and hacked) modestmaps.js and modestmaps.markers.js here?
    try {
        var MM = MM || com.modestmaps;
    } catch (e) {
        throw "Couldn't find MM or com.modestmaps. Did you include modestmaps.js?";
        return false;
    }

    var DEFAULTS = HTMAPL.defaults = {
        "map": {
            "center":       {lat: 37.764, lon: -122.419},
            "zoom":         1,
            "extent":       null,
            "provider":     "toner",
            "interactive":  "true",
            "mousewheel":   "false",
            "touch":        "false",
            "mousezoom":    null,
            "hash":         "false",
            "layers":       ".layer",
            "markers":      ".marker",
            "controls":     ".controls"
        },
        "layer": {
            "type":         "image",
            "provider":     null,
            "url":          null,
            "data_type":     "json",
            "template":     null,
            "set_extent":    "false"
        }
    };

    var ATTRIBUTES = HTMAPL.dataAttributes = {
        // map option parsers
        "map": {
            "center":       "latLon",
            "zoom":         "integer",
            "extent":       "extent",
            "provider":     "provider",
            "interactive":  "boolean",
            "mousewheel":   "boolean",
            "mousezoom":    "numarray",
            "touch":        "boolean",
            "hash":         "boolean",
            "layers":       String,
            "markers":      String,
            "controls":     String
        },
        // layer option parsers
        "layer": {
            "type":         String,
            "provider":     "provider",
            "url":          String,
            "data_type":    String,
            "template":     String,
            "set_extent":   "boolean"
        }
    };

    HTMAPL.Map = function(element, defaults) {
        this.initialize(element, defaults);
    };

    /**
     * The Map looks for options in an element, merges those with any
     * provided in the constructor, builds data and marker layers, and provides
     * an applyOptions() method for setting any post-initialization options.
     */
    HTMAPL.Map.prototype = {

        /**
         * initialize() takes an optional hash of option defaults, which
         * are merged together with HTMAPL.defaults.map to form the set of
         * options before applying any additional ones found in the DOM.
         */
        initialize: function(element, defaults) {
            // Create the map. By default our provider is empty.
            MM.Map.call(this, element, NULL_PROVIDER, null, []);

            var options = {};

            // merge in gobal defaults, then user-provided defaults
            extend(options, DEFAULTS.map, defaults);
            // console.log("options:", JSON.stringify(options));
            // parse options out of the DOM element and include those
            this.parseOptions(options, this.parent, ATTRIBUTES.map);
            // console.log("options:", JSON.stringify(options));

            if (options.mousezoom) {
                var zoomHandler = new MM.MouseMoveZoomHandler(this, options.mousezoom);
                this.eventHandlers.push(zoomHandler);
                // use the outer zoom as the default
                options.zoom = zoomHandler.outerZoom;
            } else if (options.interactive) {
                // if the "interactive" option is set, include the MouseHandler
                this.eventHandlers.push(new MM.DragHandler(this));
                this.eventHandlers.push(new MM.DoubleClickHandler(this));
                if (options.mousewheel) {
                    // TODO: precise argument for intermediate zooms
                    this.eventHandlers.push(new MM.MouseWheelHandler(this));
                }

                if (options.touch) {
                    this.eventHandlers.push(new MM.TouchHandler(this));
                }
            }

            // intialize data and marker layers
            if (options.layers) {
                this.initLayers(options.layers);
            }

            // additionally, intialize markers as their own layer
            if (options.markers) {
                this.initMarkers(options.markers);
            }

            if (options.controls) {
                this.initControls(options.controls);
            }

            // then apply the runtime options: center, zoom, extent, provider
            this._applyParsedOptions(options);

            if (options.hash === true) {
                this.eventHandlers.push(new MM.Hash(this));
            } else {
                console.log("hash?", options.hash);
            }
        },

        /**
         * Initialize markers as their own layer.
         */
        initMarkers: function(filter) {
            var markers = this.getChildren(this.parent, filter);
            if (markers.length) {
                var div = document.createElement("div"),
                    markerLayer = new MM.MarkerLayer(div);
                this.addLayerMarkers(markerLayer, markers);
                this.addLayer(markerLayer);

                this.markers = markerLayer;
                return markerLayer;
            }
            return null;
        },

        /**
         * Adds each marker element in a jQuery selection to the provided
         * ModestMaps Layer. Each marker element should have a "location" data
         * that getLatLon() can parse into a Location object.
         *
         * Returns the number of markers added with valid locations.
         */
        addLayerMarkers: function(layer, markers) {
            var added = 0,
                len = markers.length;
            for (var i = 0; i < len; i++) {
                var marker = markers[i],
                    rawLocation = this.getData(marker, "location"),
                    parsedLocation = PARSE.latLon(rawLocation);
                if (parsedLocation) {
                    layer.addMarker(marker, parsedLocation);
                    added++;
                } else {
                    console.warn("invalid marker location:", rawLocation, "; skipping marker:", marker);
                }
            }
            return added;
        },

        initLayers: function(filter) {
            var children = this.getChildren(this.parent, filter),
                len = children.length;
            for (var i = 0; i < len; i++) {
                var layer = children[i],
                    layerOptions = {};
                extend(layerOptions, DEFAULTS.layer);
                // console.log("(init) layer options:", layerOptions);

                this.parseOptions(layerOptions, layer, ATTRIBUTES.layer);

                // console.log("(parsed) layer options:", layerOptions);

                var type = layerOptions.type,
                    provider = layerOptions.provider;

                if (!type) {
                    console.warn("no type defined for layer:", layer);
                    continue;
                }

                // console.log("  + layer:", [type, provider], layer);

                var mapLayer;
                switch (type.toLowerCase()) {
                    case "markers":
                        // marker layers ignore the provider
                        mapLayer = new MM.MarkerLayer(layer);
                        this.addLayerMarkers(mapLayer, this.getChildren(layer));
                        break;

                    case "geojson":
                        var url = layerOptions.url || layerOptions.provider,
                            template = layerOptions.template,
                            tiled = url && url.match(/{(Z|X|Y)}/);

                        if (!url) {
                            console.warn("no URL/provider found for GeoJSON layer:", layer);
                            continue;
                        }

                        // console.log("template:", template);

                        var buildMarker;
                        switch (typeof template) {
                            case "function":
                                buildMarker = template;
                                break;
                            case "string":
                                buildMarker = this.getBuildMarker(template);
                                break;
                        }

                        // console.log("buildMarker:", buildMarker);

                        // XXX: two very different things happen here
                        // depending on whether the data is "tiled":
                        if (tiled) {

                            // if so, we use a GeoJSONProvider and a tiled
                            // layer...
                            if (provider) {
                                mapProvider = new MM.GeoJSONProvider(provider, buildMarker);
                                mapLayer = new MM.Layer(mapProvider, layer);
                            } else {
                                console.warn("no GeoJSON provider found for:", [url], "on layer:", layer);
                                continue;
                            }

                        } else {

                            // otherwise we create a MarkerLayer, load
                            // data, and add markers on success.
                            mapLayer = new MM.MarkerLayer(layer);

                            /**
                             * XXX:
                             * The AJAX request options follow jQuery.ajax()
                             * conventions. Currently the only option that we
                             * support is "dataType", which is assumed to be
                             * either "json" (subject to cross-origin security
                             * restrictions) or "jsonp" (which uses callbacks
                             * and is not subject to CORS restrictions).
                             */
                            var requestOptions = {
                                "dataType": layerOptions.data_type
                            };

                            // for the success closure
                            var map = this;

                            this.ajax(url, requestOptions, function(collection) {
                                var features = collection.features,
                                    len = features.length,
                                    locations = [];
                                for (var i = 0; i < len; i++) {
                                    var feature = features[i],
                                        marker = buildMarker.call(mapLayer, feature);
                                    mapLayer.addMarker(marker, feature);
                                    locations.push(marker.location);
                                }
                                if (locations.length && layerOptions.set_extent) {
                                    map.setExtent(locations);
                                } else {
                                    console.log("not setting extent:", layerOptions);
                                }
                            });
                        }
                        break;
                        
                    case "image":
                        if (!provider) {
                            console.warn("no provider found for image layer:", layer, layerOptions);
                            break;
                        }
                        mapLayer = new MM.Layer(provider, layer);
                        break;
                }

                if (mapLayer) {
                    this.addLayer(mapLayer);
                } else {
                    console.warn("no provider created for layer of type", type, ":", layer);
                }
            }
        },

        initControls: function(filter) {
            var controls = this.getChildren(this.parent, filter),
                len = controls.length;
            for (var i = 0; i < len; i++) {
                var ctrl = controls[i];
                // console.log("+ control group:", ctrl);
                if (this.isControl(ctrl)) {
                    this.initControl(ctrl);
                } else {
                    // console.log("  looking for children...", ctrl.childNodes.length);
                    var children = this.getChildren(ctrl, this.isControl),
                        clen = children.length;
                    for (var j = 0; j < clen; j++) {
                        this.initControl(children[j]);
                    }
                }
            }
        },

        isControl: function(element) {
            return element.nodeType == 1 && this.getData(element, "action");
        },

        initControl: function(element) {
            var map = this,
                action = this.getData(element, "action");
            // console.log("+ control:", element, action);

            if (action.indexOf("(") > -1) {
                function exec(e) {
                    with (map) { eval(action); }
                }
            } else {
                var args = action.split(":"),
                    name = args.shift();
                switch (name) {
                    case "setProvider":
                        // XXX: this is kind of ugly... join the args back together
                        args = [args.join(":")];
                        break;
                    case "setCenter":
                        args[0] = PARSE.latLon(args[0]);
                        break;
                    case "setCenterZoom":
                        if (args.length == 1) {
                            var cz = PARSE.centerZoom(args[0]);
                            if (cz) {
                                args[0] = cz.center;
                                args[1] = cz.zoom;
                            } else {
                                return null;
                            }
                        } else {
                            args[0] = PARSE.latLon(args[0]);
                            args[1] = PARSE.integer(args[1]);
                        }
                        break;
                    case "setZoom":
                        args[0] = PARSE.integer(args[0]);
                        break;
                    case "setExtent":
                        args[0] = PARSE.extent(args[0]);
                        break;
                }
                function exec(e) {
                    map[name].apply(map, args);
                }
            }

            // prevent double click events from bubbling up
            MM.addEvent(element, "dblclick", function(e) {
                try {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                } catch (e) {
                    console.warn("couldn't stop double-click: ", e);
                }
                return false;
            });

            // and execute the action on click
            // TODO: parse the action at runtime so it can be changed?
            MM.addEvent(element, "click", function(e) {
                // console.log("click:", element, e);
                try {
                    exec(e);
                    e.preventDefault();
                } catch (e) {
                    console.warn("failed to exec control: ", e);
                }
                return false;
            });
        },

        /**
         * Get a marker building function. This is assumed to be a symbol in
         * the global scope that can be evaluated with eval(). If the string
         * evaluates to anything other than a function, we return null.
         */
        getBuildMarker: function(name) {
            try {
                var ref;
                // TODO: replace eval() with a safe recursive lookup
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
        },

        applyOptions: function(options) {
            this.parseOptions(options, null, ATTRIBUTES.map);
            this._applyParsedOptions(options);
        },

        setCenterZoom: function(location, zoom) {
            var coord = this.locationCoordinate(location).zoomTo(zoom);
            if (this.coordinate.zoom != coord.zoom || this.coordinate.row != coord.row || this.coordinate.column != coord.column) {
                this.coordinate = coord;
                this.draw();
                this.dispatchCallback('centered', [location, zoom]);
            } else {
                return this;
            }
        },

        panBy: function(dx, dy) {
            if (dx != 0 && dy != 0) {
                return MM.Map.prototype.panBy.call(this, dx, dy);
            } else {
                return this;
            }
        },

        zoomBy: function(zoomOffset) {
            if (zoomOffset != 0) {
                return MM.Map.prototype.zoomBy.call(this, zoomOffset);
            } else {
                return this;
            }
        },

        // our setProvider() accepts a string lookup
        setProvider: function(provider) {
            if (typeof provider === "string") {
                provider = PARSE.provider(provider);
            }
            return MM.Map.prototype.setProviderAt.call(this, 0, provider);
        },

        _applyParsedOptions: function(options) {
            if (options.provider) {
                // console.log("  * base provider:", options.provider);
                var baseLayer = this.layers[0],
                    provider = (typeof options.provider === "string")
                        ? PARSE.provider(options.provider)
                        : options.provider;
                if (provider) {
                    baseLayer.setProvider(provider);
                    this.parent.insertBefore(baseLayer.parent, this.parent.firstChild);
                    // XXX: force the base map layer to the bottom
                    baseLayer.parent.style.zIndex = 0;
                }
            }

            // and kick things off by setting the extent, center and zoom
            if (options.extent) {
                this.setExtent(options.extent);
            } else if (options.center) {
                if (isNaN(options.zoom)) {
                    this.setCenter(options.center);
                } else {
                    this.setCenterZoom(options.center, options.zoom);
                }
            } else if (!isNaN(options.zoom)) {
                this.setZoom(options.zoom);
            }
        },

        /**
         * HTMAPL doesn't know how to load files natively. For now we rely on
         * jQuery.ajax() and fill in support if it's available; otherwise, we throw
         * an exception.
         */
        ajax: function(url, options, success) {
            throw "Not implemented yet; include jQuery for remote file loading via jQuery.ajax()";
        },

        /**
         * DOM data getter. This is monkey patched if jQuery is present.
         */
        getData: function(element, key) {
            if (element.hasOwnProperty("dataset")) {
                key = key.toLowerCase();
                // console.log("looking for data:", [key], "in", element.dataset);
                return element.dataset[key] || element.getAttribute("data-" + key);
            } else {
                return element.getAttribute("data-" + key);
            }
        },

        // XXX: not used anywhere yet
        setData: function(element, key, value) {
            if (!element.hasOwnProperty("dataset")) {
                element.dataset = {};
            }
            element.dataset[key] = value;
        },

        parseOptions: function(options, element, parsers) {
            // console.log("parsing:", element, "into:", options, "with:", parsers);
            for (var key in parsers) {
                var value = element ? this.getData(element, key) : null;
                // console.log("option:", key, [value], typeof value);

                // allow for options to be set to 'false' 
                if (typeof value === "undefined") {
                    value = options[key];
                    // console.log("  default:", [value], typeof value);
                }

                // console.log(" +", key, "=", value);
                // if it's a string, parse it
                if (typeof value === "string" && parsers[key] !== String) {
                    options[key] = PARSE[parsers[key]].call(element, value);
                    // console.log("  + parsed:", [options[key]], typeof options[key]);
                // if it's not undefined, assign it
                } else if (typeof value !== "undefined") {
                    options[key] = value;
                    // console.log("  + passthru:", [options[key]], typeof options[key]);
                } else {
                    // console.info("invalid value for", key, ":", value);
                }
            }
        },

        getChildren: function(element, filter) {
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

    };

    // an HTMAPL.Map is an MM.Map, but better
    MM.extend(HTMAPL.Map, MM.Map);

    /**
     * Static utility functions
     */

    /**
     * HTMAPL.makeMap() takes a DOM node reference and a hash of default
     * options, and returns a new HTMAPL.Map instance, which extends
     * ModestMaps' Map.
     */
    HTMAPL.makeMap = function(element, defaults) {
        return new HTMAPL.Map(element, defaults);
    };

    /**
     * HTMAPL.makeMaps() iterates over a list of DOM nodes and returns a
     * corresponding array of HTMAPL.Map instances. This is kind of like:
     *
     * var nodes = document.querySelectorAll("div.map");
     * var options = { ... };
     * var maps = Array.prototype.slice.call(nodes).map(function(node) {
     *     return new HTMAPL.makeMap(node, options);
     * });
     */
    HTMAPL.makeMaps = function(elements, defaults) {
        var maps = [],
            len = elements.length;
        for (var i = 0; i < len; i++) {
            maps.push(new HTMAPL.Map(elements[i], defaults));
        }
        return maps;
    };

    /**
     * Utility functions (not needed in the global scope)
     */

    /**
     * extend() updates the properties of the object provided as its first
     * argument with the proprties of one or more other arguments. E.g.:
     *
     * var a = {foo: 1};
     * extend(a, {foo: 2, bar: 1});
     * // a.foo === 2, a.bar === 1
     */
    function extend(dest, sources) {
        var argc = arguments.length - 1;
        for (var i = 1; i <= argc; i++) {
            var source = arguments[i];
            if (!source) continue;
            for (var p in source) {
                dest[p] = source[p];
            }
        }
    }

	/**
	 * Parsing Functions
	 *
	 * The following functions are used to parse meaningful values from strings,
	 * and should return null if the provided strings don't match a predefined
	 * format.
	 */
    var PARSE = HTMAPL.parse = {};

    /**
     * Parse a query string, with or without the leading "?", and with an
     * optional parameter delimiter (the default is "&"). Returns a hash of
     * string key/value pairs.
     */
    PARSE.queryString = function(str, delim) {
        // chop off the leading ?
        if (str.charAt(0) == "?") str = str.substr(1);
        var parsed = {},
            parts = str.split(delim || "&"),
            len = parts.length;
        for (var i = 0; i < len; i++) {
            var bits = parts[i].split("=", 2);
            parsed[bits[0]] = decodeURIComponent(bits[1]);
        }
        return parsed;
    };

	/**
	 * Parse a {lat,lon} object from a string: "lat,lon", or return null if the
	 * string does not contain a single comma.
	 */
 	PARSE.latLon = function(str) {
		if (typeof str === "string" && str.indexOf(",") > -1) {
			var parts = str.split(/\s*,\s*/),
                lat = parseFloat(parts[0]),
                lon = parseFloat(parts[1]);
			return {lon: lon, lat: lat};
		}
		return null;
	};

	/**
	 * Parse an {x,y} object from a string: "x,x", or return null if the string
	 * does not contain a single comma.
	 */
 	PARSE.xy = function(str) {
		if (typeof str === "string" && str.indexOf(",") > -1) {
			var parts = str.split(/\s*,\s*/),
                x = parseInt(parts[0]),
                y = parseInt(parts[1]);
			return {x: x, y: y};
		}
		return null;
	};

	/**
	 * Parse an extent array [{lat,lon},{lat,lon}] from a string:
	 * "lat1,lon1,lat2,lon2", or return null if the string does not contain a
	 * 4 comma-separated numbers.
	 */
 	PARSE.extent = function(str) {
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
	};

	/**
	 * Parse an integer from a string using parseInt(), or return null if the
	 * resulting value is NaN.
	 */
	PARSE.integer = function(str) {
		var i = parseInt(str);
		return isNaN(i) ? null : i;
	};

	/**
	 * Parse a float from a string using parseFloat(), or return null if the
	 * resulting value is NaN.
	 */
	PARSE["float"] = function(str) {
		var i = parseFloat(str);
		return isNaN(i) ? null : i;
	};

	/**
	 * Parse a string as a boolean "true" or "false", otherwise null.
	 */
	PARSE["boolean"] = function(str) {
		return (str === "true") ? true : (str === "false") ? false : null;
	};

	/**
	 * Parse a string as an array of at least two comma-separated strings, or
	 * null if it does not contain at least one comma.
	 */
	PARSE["array"] = function(str) {
		return (typeof str === "string" && str.indexOf(",") > -1) ? str.split(/\s*,\s*/) : null;
	};

	/**
	 * Parse a string as an array of integers.
	 */
	PARSE["numarray"] = function(str) {
        var a = PARSE.array(str);
        if (a) {
            var n = a.length;
            for (var i = 0; i < n; i++) {
                a[i] = Number(a[i]);
                if (isNaN(a[i])) {
                    return null;
                }
            }
        }
        return a;
	};

    var PROVIDERS = HTMAPL.providers = {};
    /**
     * Register a named map tile provider. Basic usage:
     *
     * HTMAPL.registerProvider("name", new com.modestmaps.MapProvider(...));
     *
     * You can also register tile provider "generator" prefixes with a colon
     * between the prefix and the generator argument(s). E.g.:
     *
     * HTMAPL.registerProvider("prefix", function(layer) {
     *     var url = "path/to/" + layer + "/{Z}/{X}/{Y}.png";
     *     return new com.modestmaps.TemplatedMapProvider(url);
     * });
     */
    PROVIDERS.register = function(name, provider) {
        if (typeof provider === "undefined") {
            PROVIDERS.unregister(name);
        } else {
            PROVIDERS[name] = provider;
        }
    };

    PROVIDERS.unregister = function(name) {
        delete PROVIDERS[name];
    };

    /**
     * Get a named provider
     */
    PARSE.provider = function(str) {
        if (str in PROVIDERS) {
            return (typeof PROVIDERS[str] === "function")
                ? PROVIDERS[str].call(null)
                : PROVIDERS[str];
        } else if (str.indexOf(":") > -1) {
            var parts = str.split(":"),
                prefix = parts.shift();
            if (prefix in PROVIDERS) {
                return PROVIDERS[prefix].apply(null, parts);
            }
        } else {
            return url
                ? new MM.TemplatedMapProvider(url)
                : NULL_PROVIDER;
        }
    };

    PARSE.centerZoom = function(zoomLatLon) {
        if (zoomLatLon.charAt(0) === "#") zoomLatLon = zoomLatLon.substr(1);
        var parts = zoomLatLon.split("/"),
            zoom = parseInt(parts[0]),
            lat = parseFloat(parts[1]),
            lon = parseFloat(parts[2]);
        if (isNaN(zoom) || isNaN(lat) || isNaN(lon)) {
            return null;
        } else {
            return {
                center: {lat: lat, lon: lon},
                zoom: zoom
            };
        }
    };

    /**
     * Built-in providers
     */
    var NULL_PROVIDER = new MM.MapProvider(function(c) { return null; });
    PROVIDERS.register("none",  NULL_PROVIDER);
    PROVIDERS.register("toner", new MM.TemplatedMapProvider("http://spaceclaw.stamen.com/toner/{Z}/{X}/{Y}.png"));
    PROVIDERS.register("stamen:toner", new MM.TemplatedMapProvider("http://spaceclaw.stamen.com/toner/{Z}/{X}/{Y}.png"));

    /**
     * Cloudmade style map provider generator.
     */
    PROVIDERS["bing"] = (function() {

        function makeQueryString(params) {
            var parts = [];
            for (var key in params) {
                var value = params[key];
                if (typeof value === "string" && value.length) {
                    parts.push(key, "=", encodeURIComponent(params[key]), "&");
                }
            }
            parts.pop();
            return parts.join("");
        }

        var bing = function(queryString) {
            var params = {};
            extend(params, bing.defaults);
            if (arguments.length > 0 && queryString) {
                try {
                    var parsed = PARSE.queryString(queryString);
                    extend(params, parsed);
                } catch (e) {
                    throw 'Unable to parse query string "' + queryString + '": ' + e;
                }
            }
            queryString = makeQueryString(params);
            return new MM.TemplatedMapProvider("http://ecn.t{S}.tiles.virtualearth.net/tiles/r{Q}?" + queryString, bing.subdomains);
        }
        bing.subdomains = [0, 1, 2, 3, 4, 5, 6, 7];
        bing.defaults = PARSE.queryString("g=689&mkt=en-us&lbl=l1&stl=h&shading=hill");
        return bing;
    })();

    /**
     * Cloudmade style map provider generator.
     */
    PROVIDERS["cloudmade"] = (function() {
        var aliases = {
            "fresh":    997,
            "paledawn": 998,
            "midnight": 999
        };

        var cloudmade = function(styleId) {
            if (styleId in aliases) {
                styleId = aliases[styleId];
            }
            return new MM.TemplatedMapProvider([
                "http://{S}tile.cloudmade.com",
                cloudmade.key,
                styleId,
                "256/{Z}/{X}/{Y}.png"
            ].join("/"), cloudmade.domains);
        };

        // FIXME: use another key? require the user to set this?
        cloudmade.key = "1a1b06b230af4efdbb989ea99e9841af";
        cloudmade.domains = ["a.", "b.", "c.", ""];
        // e.g.:
        // HTMAPL.providers.cloudmade.registerAlias("fresh", 997);
        cloudmade.registerAlias = function(alias, styleId) {
            aliases[alias] = styleId;
        };

        return cloudmade;
    })();

    /**
     * Mapbox provider generator
     */
    PROVIDERS["mapbox"] = (function() {
        var mapbox = function(layer) {
            // if we have multiple arguments, join them into one: "user.layer"
            if (arguments.length > 1) {
                layer = Array.prototype.join.call(arguments, ".");
            }
            return new MM.TemplatedMapProvider(
                "http://{S}.tiles.mapbox.com/v2/" + layer + "/{Z}/{X}/{Y}.png",
                mapbox.domains);
        };
        mapbox.domains = ["a", "b", "c"];
        return mapbox;
    })();

    /**
     * Acetate layer generator
     */
    PROVIDERS["acetate"] = function(layer) {
        if (!layer) layer = "acetate";
        else if (layer.indexOf("acetate") != 0) layer = "acetate-" + layer;
        return new MM.TemplatedMapProvider("http://acetate.geoiq.com/tiles/" + layer + "/{Z}/{X}/{Y}.png");
    };

    // jQuery-specific stuff
    if (typeof jQuery !== "undefined") {

        var $ = jQuery;

        // use jQuery.ajax();
        HTMAPL.Map.prototype.ajax = function(url, options, success) {
            return $.ajax(url, options).done(success);
        };

        /**
         * Use jQuery.data() so that you can set data via the same interface:
         *
         * $("div.map").data("provider", "toner").htmapl();
         */
        HTMAPL.Map.prototype.getData = function(element, key) {
            return $(element).data(key);
        };

        HTMAPL.Map.prototype.getChildren = function(element, filter) {
            return $(element).children(filter);
        };

        /**
         * Monkey patch Map::getBuildMarker() if jQuery templates are
         * available. This modifies the prototype method to look for a named
         * template
         */
        if (typeof $.fn.tmpl === "function") {
            var oldBuildMarker = HTMAPL.Map.prototype.getBuildMarker;
            HTMAPL.Map.prototype.getBuildMarker = function(name) {
                var existing = oldBuildMarker(name);
                if (existing) {
                    return exiting;
                } else {
                    // check to see if the provided name is a selector
                    var target = $(name);
                    // if there's a matching element, use that as the template
                    // and return a function that uses that template in a closure
                    if (target.length == 1) {
                        var template = target.template();
                        return function(feature) {
                            return $.tmpl(template, feature).get(0);
                        };
                    // otherwise, return a function that passes the name in as
                    // the template identifier
                    } else {
                        return function(feature) {
                            return $.tmp(name, feature).get(0);
                        };
                    }
                }
            };
        }

        // keep a reference around to the plugin object for exporting useful functions
        $.fn.htmapl = function(options, argn) {
            var args = Array.prototype.slice.call(arguments, 1);
            return this.each(function() {
                var $this = $(this),
                    map = $(this).data("map");
                if (map) {
                    if (typeof options === "string") {
                        if (typeof map[options] === "function") {
                            var method = options;
                            // console.log("calling map." + method, "with:", args);
                            map[method].apply(map, args);
                        } else {
                            map[options] = argn;
                        }
                    } else if (typeof options === "object") {
                        map.applyOptions(options);
                    }
                } else {
                    try {
                        map = HTMAPL.makeMap(this, options);
                        var layers = map.layers,
                            len = layers.length;
                        for (var i = 0; i < len; i++) {
                            $(layers[i].parent).data("layer", layers[i]);
                        }
                        $this.data("map", map);

                        map.addCallback("panned", function(_, panOffset) {
                            $this.trigger("map.panned", {center: map.getCenter(), offset: panOffset});
                        });

                        map.addCallback("zoomed", function(_, zoomDelta) {
                            $this.trigger("map.zoomed", {zoom: map.getZoom(), delta: zoomDelta});
                        });

                        map.addCallback("centered", function() {
                            $this.trigger("map.centered", {center: map.getCenter()});
                        });

                        map.addCallback("extentset", function() {
                            $this.trigger("map.extentset", {extent: map.getExtent()});
                        });

                        map.addCallback("resized", function() {
                            $this.trigger("map.resized", {size: map.dimensions});
                        });

                    } catch (e) {
                        console.error("unable to makeMap(): ", e.message);
                    }
                }
            });
        };

        $.fn.center = function() {
            if (arguments.length == 0) {
                return this.data("map").getCenter();
            } else {
                var center, zoom;
                if (arguments.length == 1) {
                    if (typeof arguments[0] === "object") {
                        center = arguments[0];
                    } else if (typeof arguments[0] === "string") {
                        center = PARSE.latLon(arguments[0]);
                    }
                } else if (arguments.length == 2) {
                    if (typeof arguments[0] === "object") {
                        center = arguments[0];
                        zoom = Number(arguments[1]);
                    } else {
                        center = {lat: Number(arguments[0]), lon: Number(arguments[1])};
                    }
                } else if (arguments.length == 3) {
                    center = {lat: Number(arguments[0]), lon: Number(arguments[1])};
                    zoom = Number(arguments[2]);
                }
                if (!center) {
                    return this;
                }
                return isNaN(zoom)
                    ? this.each(function() {
                        $(this).data("map").setCenter(center);
                    })
                    : this.each(function() {
                        $(this).data("map").setCenterZoom(center, zoom);
                    });
            }
        };

        $.fn.zoom = function(zoom) {
            if (arguments.length == 0) {
                return this.data("map").getZoom();
            } else {
                if (typeof zoom === "string") {
                    zoom = parseInt(zoom);
                }
                return this.each(function() {
                    $(this).data("map").setZoom(zoom);
                });
            }
        };

        $.fn.extent = function(extent) {
            if (arguments.length == 0) {
                return this.data("map").getExtent();
            } else {
                if (typeof extent === "string") {
                    extent = PARSE.extent(extent);
                }
                return this.each(function() {
                    $(this).data("map").setExtent(extent);
                });
            }
        };

        $.fn.centerZoom = function(lat, lon, zoom) {
            var center;
            if (arguments.length == 2) {
                if (typeof lat === "object") {
                    center = lat;
                } else if (typeof lat === "string") {
                    center = PARSE.latLon(lat);
                }
                zoom = lon;
            } else {
                center = {lat: Number(lat), lon: Number(lon)};
            }
            return this.each(function() {
                $(this).data("map").setCenterZoom(center, zoom);
            });
        };

        // TODO: no getProvider()?
        $.fn.provider = function(provider) {
            return this.each(function() {
                $(this).data("map").setProvider(provider);
            });
        };

        // automatically map-ulate anything with data-htmapl="true"
        $(function() {
            $("*[data-htmapl=true]").htmapl();
        });

    }

})();
(function(MM) {

    /**
     * The MarkerLayer doesn't do any tile stuff, so it doesn't need to
     * inherit from MM.Layer. The constructor takes only an optional parent
     * element.
     *
     * Usage:
     *
     * // create the map with some constructor parameters
     * var map = new MM.Map(...);
     * // create a new MarkerLayer instance and add it to the map
     * var layer = new MM.MarkerLayer();
     * map.addLayer(layer);
     * // create a marker element
     * var marker = document.createElement("a");
     * marker.innerHTML = "Stamen";
     * // add it to the layer at the specified geographic location
     * layer.addMarker(marker, new MM.Location(37.764, -122.419));
     * // center the map on the marker's location
     * map.setCenterZoom(marker.location, 13);
     *
     */
    MM.MarkerLayer = function(parent) {
        this.parent = parent || document.createElement('div');
        this.parent.style.cssText = 'position: absolute; top: 0px; left: 0px; width: 100%; height: 100%; margin: 0; padding: 0; z-index: 0';
        this.markers = [];
        this.resetPosition();
    };

    MM.MarkerLayer.prototype = {
        // a list of our markers
        markers: null,
        // the absolute position of the parent element
        position: null,

        // the last coordinate we saw on the map
        lastCoord: null,
        draw: function() {
            // these are our previous and next map center coordinates
            var prev = this.lastCoord,
                next = this.map.pointCoordinate({x: 0, y: 0});
            // if we've recorded the map's previous center...
            if (prev) {
                // if the zoom hasn't changed, find the delta in screen
                // coordinates and pan the parent element
                if (prev.zoom == next.zoom) {
                    var p1 = this.map.coordinatePoint(prev),
                        p2 = this.map.coordinatePoint(next),
                        dx = p1.x - p2.x,
                        dy = p1.y - p2.y;
                    // console.log("panned:", [dx, dy]);
                    this.onPanned(dx, dy);
                // otherwise, reposition all the markers
                } else {
                    this.onZoomed();
                }
            // otherwise, reposition all the markers
            } else {
                this.onZoomed();
            }
            // remember the previous center
            this.lastCoord = next.copy();
        },

        // when zoomed, reset the position and reposition all markers
        onZoomed: function() {
            this.resetPosition();
            this.repositionAllMarkers();
        },

        // when panned, offset the position by the provided screen coordinate x
        // and y values
        onPanned: function(dx, dy) {
            this.position.x += dx;
            this.position.y += dy;
            this.parent.style.left = ~~(this.position.x + .5) + "px";
            this.parent.style.top = ~~(this.position.y + .5) + "px";
        },

        // remove all markers
        removeAllMarkers: function() {
            while (this.markers.length > 0) {
                this.removeMarker(this.markers[0]);
            }
        },

        /**
         * Coerce the provided value into a Location instance. The following
         * values are supported:
         *
         * 1. MM.Location instances
         * 2. Object literals with numeric "lat" and "lon" properties
         * 3. A string in the form "lat,lon"
         * 4. GeoJSON objects with "Point" geometries
         *
         * This function throws an exception on error.
         */
        coerceLocation: function(feature) {
            switch (typeof feature) {
                case "string":
                    // "lat,lon" string
                    return MM.Location.fromString(feature);

                case "object":
                    // GeoJSON
                    if (typeof feature.geometry === "object") {
                        var geom = feature.geometry;
                        switch (geom.type) {
                            // Point geometries => MM.Location
                            case "Point":
                                // coerce the lat and lon values, just in case
                                var lon = Number(geom.coordinates[0]),
                                    lat = Number(geom.coordinates[1]);
                                return new MM.Location(lat, lon);
                        }
                        throw 'Unable to get the location of GeoJSON "' + geom.type + '" geometry!';
                    } else if (feature instanceof MM.Location ||
                        (typeof feature.lat !== "undefined" && typeof feature.lon !== "undefined")) {
                        return feature;
                    } else {
                        throw 'Unknown location object; no "lat" and "lon" properties found!';
                    }
                    break;

                case "undefined":
                    throw 'Location "undefined"';
            }
        },

        /**
         * Add an HTML element as a marker, located at the position of the
         * provided GeoJSON feature, Location instance (or {lat,lon} object
         * literal), or "lat,lon" string.
         */
        addMarker: function(marker, feature) {
            if (!marker || !feature) {
                return null;
            }
            // convert the feature to a Location instance
            marker.location = this.coerceLocation(feature);
            // position: absolute
            marker.style.position = "absolute";
            if (this.map) {
                // update the marker's position
                this.repositionMarker(marker);
            }
            // append it to the DOM
            this.parent.appendChild(marker);
            // add it to the list
            this.markers.push(marker);
            return marker;
        },

        /**
         * Remove the element marker from the layer and the DOM.
         */
        removeMarker: function(marker) {
            var index = this.markers.indexOf(marker);
            if (index > -1) {
                this.markers.splice(index, 1);
            }
            if (marker.parentNode == this.parent) {
                this.parent.removeChild(marker);
            }
            return marker;
        },

        // reset the absolute position of the layer's parent element
        resetPosition: function() {
            this.position = new MM.Point(0, 0);
            this.parent.style.left = this.parent.style.top = "0px";
        },

        // reposition a single marker element
        repositionMarker: function(marker) {
            if (!marker.coord) {
                marker.coord = this.map.locationCoordinate(marker.location);
            }
            var pos = this.map.coordinatePoint(marker.coord);
            // offset by the layer parent position if x or y is non-zero
            if (this.position.x || this.position.y) {
                pos.x -= this.position.x;
                pos.y -= this.position.y;
            }
            marker.style.left = ~~(pos.x + .5) + "px";
            marker.style.top = ~~(pos.y + .5) + "px";
        },

        // Reposition al markers
        repositionAllMarkers: function() {
            var len = this.markers.length;
            for (var i = 0; i < len; i++) {
                this.repositionMarker(this.markers[i]);
            }
        }
    };

    // Array.indexOf polyfill courtesy of Mozilla MDN:
    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
            "use strict";
            if (this === void 0 || this === null) {
                throw new TypeError();
            }
            var t = Object(this);
            var len = t.length >>> 0;
            if (len === 0) {
                return -1;
            }
            var n = 0;
            if (arguments.length > 0) {
                n = Number(arguments[1]);
                if (n !== n) { // shortcut for verifying if it's NaN
                    n = 0;
                } else if (n !== 0 && n !== Infinity && n !== -Infinity) {
                    n = (n > 0 || -1) * Math.floor(Math.abs(n));
                }
            }
            if (n >= len) {
                return -1;
            }
            var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
            for (; k < len; k++) {
                if (k in t && t[k] === searchElement) {
                    return k;
                }
            }
            return -1;
        }
    }

})(MM);
(function(MM) {

    MM.MouseMoveZoomHandler = function(map, zooms, factors) {
        this.onMouseMove = MM.bind(this.onMouseMove, this);
        if (map) {
            this.init(map);
        }
        if (typeof zooms === "object") {
            if (zooms[2] > zooms[0]) {
                this.innerZoom = zooms[2];
                this.midZoom = zooms[1];
                this.outerZoom = zooms[0];
            } else {
                this.innerZoom = zooms[0];
                this.midZoom = zooms[1];
                this.outerZoom = zooms[2];
            }
        }
        if (typeof factors === "object") {
            this.innerZoomFactor = Math.max(factors[0], factors[1]);
            this.outerZoomFactor = Math.min(factors[0], factors[1]);
        }
    };

    MM.MouseMoveZoomHandler.prototype = {
        // outer zoom
        outerZoom: 3,
        // mouse distance from center (0-1) at which the outer zoom applies
        outerZoomFactor: .6,
        // mid-level zoom (applies at outerZoomFactor < distance < innerZoomFactor)
        midZoom: 9,
        // inner zoom
        innerZoom: 13,
        // mouse distance from center (0-1) at which the inner zoom applies
        innerZoomFactor: .2,

        init: function(map) {
            this.map = map;
            MM.addEvent(this.map.parent, "mousemove", this.onMouseMove);
        },

        remove: function() {
            MM.removeEvent(this.map.parent, "mousemove", this.onMouseMove);
            this.map = null;
        },

        onMouseMove: function(e) {
            var mouse = MM.getMousePoint(e, this.map),
                size = this.map.dimensions,
                // center x and y
                cx = size.x / 2,
                cy = size.y / 2,
                // mouse distance from center in x and y dims
                dx = Math.abs(cx - mouse.x) / cx,
                dy = Math.abs(cy - mouse.y) / cy,
                // normalized distance is the max of dx and dy
                f = Math.max(dx, dy),
                // default zoom is mid-level
                z = this.midZoom;
            if (f <= this.innerZoomFactor) {
                z = this.innerZoom;
            } else if (f >= this.outerZoomFactor) {
                z = this.outerZoom;
            }
            this.map.setCenterZoom(this.map.getCenter(), z);
        }
    };

})(MM);
