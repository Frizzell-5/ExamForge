#!/bin/zsh
# Double-click to launch ExamForge.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
(sleep 1.5 && open "http://localhost:4317") &
node server.js
