# firmware-c/tests/Makefile
CC = gcc
CFLAGS = -Wall -Wextra -std=c11

test: test_protocol
	./test_protocol

test_protocol: test_protocol.c ../src/protocol.c ../src/protocol.h
	$(CC) $(CFLAGS) -I../src -o $@ test_protocol.c ../src/protocol.c

clean:
	rm -f test_protocol

.PHONY: test clean
