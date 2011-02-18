(function($) {

 	function templatize(template, obj) {
		return template.replace(/{(.+)}/g, function(s, prop) {
			return obj[prop];
		});
	}

 	function getLatLon(str) {
		if (typeof str === "string" && str.indexOf(",") > -1) {
			var parts = str.split(/\s*,\s*/),
					lat = parseFloat(parts[0]),
					lon = parseFloat(parts[1]);
			return {lon: lon, lat: lat};
		}
		return null;
	}

 	function getXY(str) {
		if (typeof str === "string" && str.indexOf(",") > -1) {
			var parts = str.split(/\s*,\s*/),
					x = parseInt(parts[0]),
					y = parseInt(parts[1]);
			return {x: x, y: y};
		}
		return null;
	}

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

	function getInt(str) {
		var i = parseInt(str);
		return isNaN(i) ? null : i;
	}

	function getFloat(str) {
		var i = parseFloat(str);
		return isNaN(i) ? null : i;
	}

	function getBoolean(str) {
		return (str === "true") ? true : (str === "false") ? false : null;
	}

	// This is kind of stupid.
 	function parseCSS(str) {
		if (!str) return null;
		var style = {},
				count = 0;
		var rules = str.match(/([-a-z]+\:\s*[^;]+)/g);
		if (rules) {
			for (var i = 0; i < rules.length; i++) {
				var match = rules[i].match(/^([-a-z]+):\s*([^;]+)$/);
				if (match) {
					style[match[1]] = match[2];
					count++;
				}
			}
		}
		return count > 0 ? style : null;
	}

	// apply
	function applyData(obj, map, attrs) {
		for (var key in attrs) {
			var value = attrs[key];
			// call it as function(data) with the element as its context
			if (typeof value == "function") {
				value = value(obj.data(key));
			}
			// don't apply null values
			if (value == null) {
				continue;
			}
			// apply as function if it is one
			if (typeof map[key] == "function") {
				// console.log("map." + key + "(" + JSON.stringify(value) + ")");
				map[key](value);
			// or just set the key on the map object
			} else {
				map[key] = value;
			}
		}
	}

	function htmapl(el, defaults) {
		var po = org.polymaps;
		// the root element
		var root = $(el),
				container = el.appendChild(po.svg("svg")),
				map = po.map().container(container);

		if (defaults) {
			applyData(root, map, defaults);
		}

		applyData(root, map, {
			// extent comes in "lon,lat,lon,lat" format
			extent: 	getExtent,
			// center comes in "lon,lat" format
			center: 	getLatLon,
			// zoom is a float
			zoom: 		getFloat,
			// size comes in "x,y"
			size: 		getXY,
			// tileSize comes in "x,y"
			tileSize: getXY,
			// angle is a float
			angle:		getFloat
		});

		// Interaction! We don't do the wheel by default here;
		// in order to enable it, you need to explicitly set the
		// "wheel" class on the containing element.
		if (root.hasClass("interact")) {
			map.add(po.dblclick());
			map.add(po.drag());
			map.add(po.arrow());
			if (root.hasClass("wheel")) {
				map.add(po.wheel().smooth(root.hasClass("smooth")));
			}
		} else {
			if (root.hasClass("drag")) {
				map.add(po.drag());
			}
			if (root.hasClass("arrow")) {
				var arrow = po.arrow();
				map.add(arrow);
			}
			if (root.hasClass("wheel")) {
				map.add(po.wheel().smooth(root.hasClass("smooth")));
			}
		}
		// hash stashing
		if (root.hasClass("hash")) {
			map.add(po.hash());
		}

		root.find(".layer").each(function(j, subel) {
			var source = $(subel),
					layer,
					attrs = {},
					type = source.data("type");
			switch (type) {
				case "image":
					layer = po.image();
					attrs.url = String;
					attrs.visible = getBoolean;
					attrs.tile = getBoolean;
					attrs.zoom = getFloat;
					break;

				case "geoJson":
				case "geoJson-p":
					layer = (type == "geoJson-p")
						? po.geoJson(po.queue.jsonp)
						: po.geoJson();
					attrs.url = String;
					attrs.visible = getBoolean;
					attrs.scale = String;
					attrs.tile = getBoolean;
					attrs.zoom = getFloat;
					// allow string parsing of JSON features?
					/*
					if (JSON && typeof JSON.parse === "function") {
						attrs.features = JSON.parse;
					}
					*/
					attrs.clip = getBoolean;

					var str = source.data("style"),
							style = parseCSS(str);
					if (style) {
						var stylist = po.stylist();
						for (var name in style) {
							var value = style[name], js;
							if (js = value.match(/^javascript:(.*)$/)) {
								try {
									value = eval(js[1]);
								} catch (e) {
									// console.log("unable to eval('" + js[1] + "'): " + e);
								}
							}
							stylist.attr(name, value);
						}

						var titleTemplate = source.data("title");
						if (titleTemplate) {
							stylist.title(function(feature) {
								return templatize(titleTemplate, feature.properties);
							});
						}

						layer.on("load", stylist);

						var linkTemplate = source.data("href");
						if (linkTemplate) {
							layer.on("load", function(e) {
								var len = e.features.length;
								for (var i = 0; i < len; i++) {
									var href = templatize(linkTemplate, e.features[i].data.properties);
									if (href) {
										var o = e.features[i].element,
												p = o.parentNode,
												a = po.svg("a");
										p.appendChild(a).appendChild(o);
										a.setAttributeNS(po.ns.xlink, "href", href);
									}
								}
							});
						}
					}

					break;

				case "compass":
					layer = po.compass();
					attrs.radius = getFloat;
					attrs.speed = getFloat;
					attrs.position = String;
					attrs.pan = String;
					attrs.zoom = String;
					break;

				case "grid":
					layer = po.grid();
					break;
			}

			if (layer) {
				applyData(source, layer, attrs);
				if (source.id) layer.id(source.id);
				map.add(layer);
			}
		}).remove();

		return root.data("map", map);
	}

	$.fn.htmapl = function(defaults) {
		return this.each(function(i, el) {
			htmapl(el, defaults);
		});
	};

})(jQuery);
