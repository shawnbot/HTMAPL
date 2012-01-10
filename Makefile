JS_FILES = \
	src/htmapl.js \
	lib/modestmaps.markers.js \
	lib/modestmaps.mousezoom.js

COMPRESSOR = java -jar tools/yuicompressor-2.4.2.jar

all: htmapl.js htmapl.min.js htmapl-standalone.js htmapl-standalone.min.js

htmapl.js:
	cat $(JS_FILES) >> $@
	chmod a-w $@

htmapl.min.js: htmapl.js
	rm -f $@
	$(COMPRESSOR) $< > $@
	chmod a-w $@

htmapl-standalone.js:
	cat lib/modestmaps.js $(JS_FILES) >> $@
	chmod a-w $@

htmapl-standalone.min.js: htmapl-standalone.js
	rm -f $@
	$(COMPRESSOR) $< > $@
	chmod a-w $@

clean:
	rm -f htmapl.js
	rm -f htmapl.min.js
	rm -f htmapl-standalone.js
	rm -f htmapl-standalone.min.js
