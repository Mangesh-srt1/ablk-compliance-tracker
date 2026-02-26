#!/bin/sh
if [ -z "$husky_skip_init" ]; then
  export husky_skip_init=1
  . "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/husky.sh"
fi
