
all: build

build: # Compile
	pio run

upload: # Upload the script
	pio run -t upload


monitor: # Start monitoring the port
	pio device monitor

cc: # Export compile commands
	pio run -t compiledb

clean:
	pio run -t clean

.PHONY: all build upload monitor cc clean
