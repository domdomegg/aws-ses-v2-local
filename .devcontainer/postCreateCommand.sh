#!/usr/bin/env bash

set -euxo pipefail

sed -i ~/.zshrc -e 's/^ZSH_THEME=.*/ZSH_THEME="refined"/'
