// ==============================
// Goal Publisher
// manifest.json を唯一の目的地データとして使用する
// 1. 目的地ボタンを自動生成
// 2. 選択中の目的地表示を自動更新
// 3. yaw を Quaternion に変換
// 4. /goal_pose に PoseStamped を送信
// ==============================

function initializeGoalPublisher(ros) {
    const MANIFEST_PATH = "./manifest.json";
    const GOAL_TOPIC_NAME = "/goal_pose";
    const GOAL_MESSAGE_TYPE = "geometry_msgs/msg/PoseStamped";

    const destinationCard = document.querySelector(".destination-card");
    const selectedDestination = document.getElementById("selected-destination");
    const selectedTime = document.getElementById("selected-time");

    let destinations = [];
    let goalTopic = null;

    // ==============================
    // yaw（度）を Quaternion へ変換
    // ==============================
    function yawToQuaternion(yawDegree) {
        const yaw = Number(yawDegree);

        if (!Number.isFinite(yaw)) {
            throw new Error(`yawが正しい数値ではありません: ${yawDegree}`);
        }

        const yawRadian = yaw * Math.PI / 180;

        return {
            x: 0.0,
            y: 0.0,
            z: Math.sin(yawRadian / 2),
            w: Math.cos(yawRadian / 2)
        };
    }

    // ==============================
    // 現在時刻を ROS 2 形式へ変換
    // ==============================
    function createRosTime() {
        const nowMilliseconds = Date.now();

        return {
            sec: Math.floor(nowMilliseconds / 1000),
            nanosec: (nowMilliseconds % 1000) * 1000000
        };
    }

    // ==============================
    // Goal Topic を一度だけ作成
    // ==============================
    function getGoalTopic() {
        if (!goalTopic) {
            goalTopic = new ROSLIB.Topic({
                ros: ros,
                name: GOAL_TOPIC_NAME,
                messageType: GOAL_MESSAGE_TYPE
            });
        }

        return goalTopic;
    }

    // ==============================
    // manifest.json の1件を検証
    // ==============================
    function validateDestination(destination, index) {
        if (!destination || typeof destination !== "object") {
            throw new Error(`destinations[${index}] がオブジェクトではありません`);
        }

        if (!destination.id || !destination.name) {
            throw new Error(`destinations[${index}] に id または name がありません`);
        }

        const position = destination.position;

        if (
            !position ||
            !Number.isFinite(Number(position.x)) ||
            !Number.isFinite(Number(position.y)) ||
            !Number.isFinite(Number(position.z ?? 0.0))
        ) {
            throw new Error(`destinations[${index}] の position が正しくありません`);
        }

        if (!Number.isFinite(Number(destination.yaw))) {
            throw new Error(`destinations[${index}] の yaw が正しくありません`);
        }
    }

    // ==============================
    // 選択中の表示を更新
    // ==============================
    function selectDestination(button, destination) {
        document.querySelectorAll(".destination").forEach(item => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        if (selectedDestination) {
            selectedDestination.textContent = destination.name;
        }

        if (selectedTime) {
            selectedTime.textContent = destination.estimatedTime ?? "--";
        }
    }

    // ==============================
    // 目的地を ROS へ送信
    // ==============================
    function publishGoal(destination) {
        if (!destination) {
            console.error("目的地データが見つかりません");
            return;
        }

        if (!ros || !ros.isConnected) {
            console.warn("ROSに接続されていないため、目的地を送信できません");
            return;
        }

        let orientation;

        try {
            orientation = yawToQuaternion(destination.yaw);
        } catch (error) {
            console.error(error);
            return;
        }

        const position = destination.position;

        const goalMessage = new ROSLIB.Message({
            header: {
                stamp: createRosTime(),
                frame_id: "map"
            },
            pose: {
                position: {
                    x: Number(position.x),
                    y: Number(position.y),
                    z: Number(position.z ?? 0.0)
                },
                orientation: orientation
            }
        });

        getGoalTopic().publish(goalMessage);

        console.log(`目的地を送信しました: ${destination.name}`, goalMessage);
    }

    // ==============================
    // 目的地ボタンを1個作成
    // ==============================
    function createDestinationButton(destination, index) {
        const button = document.createElement("div");
        button.className = "destination";
        button.dataset.destinationId = destination.id;
        button.setAttribute("role", "button");
        button.setAttribute("tabindex", "0");

        const name = document.createElement("span");
        name.textContent = destination.name;

        const time = document.createElement("span");
        time.textContent = destination.estimatedTime ?? "--";

        button.append(name, time);

        const activate = () => {
            selectDestination(button, destination);
            publishGoal(destination);
        };

        button.addEventListener("click", activate);

        button.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            event.preventDefault();
            activate();
        });

        if (index === 0) {
            selectDestination(button, destination);
        }

        return button;
    }

    // ==============================
    // manifest.json からボタンを自動生成
    // ==============================
    function renderDestinationButtons() {
        if (!destinationCard) {
            throw new Error(".destination-card が index.html にありません");
        }

        destinationCard.querySelectorAll(".destination").forEach(button => {
            button.remove();
        });

        document.getElementById("destination-loading")?.remove();
        document.getElementById("destination-error")?.remove();

        destinations.forEach((destination, index) => {
            destinationCard.appendChild(
                createDestinationButton(destination, index)
            );
        });
    }

    // ==============================
    // 読み込み失敗を画面に表示
    // ==============================
    function showLoadError(message) {
        document.getElementById("destination-loading")?.remove();

        if (!destinationCard) {
            return;
        }

        const errorMessage = document.createElement("p");
        errorMessage.id = "destination-error";
        errorMessage.textContent = message;
        destinationCard.appendChild(errorMessage);

        if (selectedDestination) {
            selectedDestination.textContent = "読み込み失敗";
        }

        if (selectedTime) {
            selectedTime.textContent = "--";
        }
    }

    // ==============================
    // manifest.json を読み込む
    // cache: no-store により、更新後の再読み込みで最新内容を取得
    // ==============================
    fetch(`${MANIFEST_PATH}?t=${Date.now()}`, {
        cache: "no-store"
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `manifest.jsonの読み込みに失敗しました: ${response.status}`
                );
            }

            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data.destinations)) {
                throw new Error("manifest.jsonにdestinations配列がありません");
            }

            if (data.destinations.length === 0) {
                throw new Error("manifest.jsonに目的地が1件もありません");
            }

            data.destinations.forEach(validateDestination);

            const ids = data.destinations.map(destination => destination.id);
            if (new Set(ids).size !== ids.length) {
                throw new Error("manifest.jsonの目的地idが重複しています");
            }

            destinations = data.destinations;
            renderDestinationButtons();

            console.log("目的地データを読み込みました:", destinations);
        })
        .catch(error => {
            console.error("goal.js エラー:", error);
            showLoadError("目的地の読み込みに失敗しました");
        });
}
