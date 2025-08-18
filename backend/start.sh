#!/bin/bash

# Give your session a unique name
SESSION_NAME="virtual_human_sim"

# Kill existing session if already running
tmux kill-session -t $SESSION_NAME 2>/dev/null

# Create new tmux session in detached mode
tmux new-session -d -s $SESSION_NAME

# --- Pane 0: Gunicorn backend ---
tmux send-keys -t $SESSION_NAME "cd ~/virtual_human_simulation" C-m
tmux send-keys -t $SESSION_NAME "gunicorn -k gevent -w 1 app:app --bind 0.0.0.0:5000 --timeout 300" C-m

# Split a new pane horizontally and launch frontend server
tmux split-window -h -t $SESSION_NAME
tmux send-keys -t $SESSION_NAME "cd ~/virtual_human_simulation/frontend" C-m
tmux send-keys -t $SESSION_NAME "python3 -m http.server 5500" C-m

# Attach to session so you can see both
tmux attach-session -t $SESSION_NAME
