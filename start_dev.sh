# #!/bin/bash

# echo "Starting Interview Coach Development Environment..."
# echo

# echo "Starting Flask Backend..."
# cd backend && python app.py &
# BACKEND_PID=$!

# echo "Waiting for backend to start..."
# sleep 3

# echo "Starting React Frontend..."
# cd frontend
# npm run dev &
# FRONTEND_PID=$!

# echo
# echo "Development servers are starting..."
# echo "Backend: http://localhost:5000"
# echo "Frontend: http://localhost:5173 (or check terminal for actual port)"
# echo
# echo "Press Ctrl+C to stop all servers..."

# # Wait for user to stop
# trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
# wait 

#!/bin/bash

echo "========================================="
echo "  Starting Interview Coach Dev Environment"
echo "========================================="
echo

# Step 1: Install dependencies
echo "Running install_dependencies_macos.sh..."
chmod +x install_dependencies_macos.sh
./install_dependencies_macos.sh
echo

# Step 2: Start Supabase safely
echo "Checking Supabase status..."
cd supabase || exit
if supabase status 2>/dev/null | grep -iq "stopped"; then
    echo "Supabase is not running. Attempting to start..."
    if ! supabase start --debug; then
        echo "Supabase start failed. Trying to remove old containers..."
        docker ps -a --filter "name=supabase" --format "{{.ID}}" | while read -r container; do
            echo "Removing container $container"
            docker rm -f "$container"
        done
        echo "Retrying Supabase start..."
        supabase start
    fi
else
    echo "Supabase is already running."
fi
echo

# Step 3: Serve Supabase functions
echo "Starting Supabase functions serve..."
supabase functions serve  &
SUPABASE_PID=$!
sleep 3
cd ..

# Step 4: Start Flask Backend in conda environment
echo "Starting Flask Backend (interview-coach conda env)..."
cd backend || exit
source $(conda info --base)/etc/profile.d/conda.sh
conda activate interview-coach
python app.py &
BACKEND_PID=$!
sleep 3
cd ..

# Step 5: Start React Frontend
echo "Starting React Frontend..."
cd frontend || exit
npm run dev &
FRONTEND_PID=$!
cd ..

echo
echo "========================================="
echo "Development servers are starting..."
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:5173 (check terminal for actual port)"
echo "========================================="
echo
echo "Press Ctrl+C to stop all servers..."

# Step 6: Trap Ctrl+C and stop everything
trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID $SUPABASE_PID 2>/dev/null; conda deactivate 2>/dev/null; exit" INT

wait
