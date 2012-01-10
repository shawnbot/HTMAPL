(function(MM) {

    MM.MouseMoveZoomHandler = function(map, zooms, factors) {
        this.onMouseMove = MM.bind(this.onMouseMove, this);
        if (map) {
            this.init(map);
        }
        if (typeof zooms === "object") {
            if (zooms[2] > zooms[0]) {
                this.innerZoom = zooms[0];
                this.midZoom = zooms[1];
                this.outerZoom = zooms[2];
            } else {
                this.innerZoom = zooms[2];
                this.midZoom = zooms[1];
                this.outerZoom = zooms[0];
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
            if (f >= this.outerZoomFactor) {
                z = this.outerZoom;
            } else if (f <= this.innerZoomFactor) {
                z = this.innerZoom;
            }
            this.map.setCenterZoom(map.getCenter(), z);
        }
    };

})(MM);
