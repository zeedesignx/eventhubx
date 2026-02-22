---
description: Start the EventHubX FastAPI local server
---

// turbo-all
1. Check if dependencies are installed.
```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt httpx
```

2. Start the FastAPI server using the local virtual environment.
```powershell
.\.venv\Scripts\python.exe main.py
```

3. Verify the server is running on localhost:3000.
```powershell
netstat -ano | findstr :3000
```
