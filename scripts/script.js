const ros = new ROSLIB.Ros({
    url: "ws://pbl.local:9090"
});


const connection_status = document.getElementById('connection-status');

// 接続時
ros.on('connection', () => {
    connection_status.textContent = '接続中';
});

// 切断時
ros.on('close', () => {
    connection_status.textContent = '未接続';
});

// エラー時
ros.on('error', (error) => {
    console.error('ROS connection error:', error);
    connection_status.textContent = '接続エラー';
});

