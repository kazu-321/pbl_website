console.log("goal.js pose status version loaded");

// ==============================
// Goal Publisher
// manifest.json を唯一の目的地データとして使用する
// ==============================

function initializeGoalPublisher(ros) {
    const MANIFEST_PATH =
        "./manifest.json";

    const GOAL_TOPIC_NAME =
        "/goal_pose";

    const GOAL_MESSAGE_TYPE =
        "geometry_msgs/msg/PoseStamped";

    // 自己位置不明時に表示する文字
    const UNKNOWN_TIME_TEXT = "－";

    const destinationCard =
        document.querySelector(
            ".destination-card"
        );

    const selectedDestination =
        document.getElementById(
            "selected-destination"
        );

    const selectedTime =
        document.getElementById(
            "selected-time"
        );

    let destinations = [];
    let goalTopic = null;

    let selectedDestinationData = null;


    // ==============================
    // Pose Status
    // ==============================

    function poseIsAvailable() {
        return (
            typeof window
                .isRobotPoseAvailable ===
                "function" &&
            window.isRobotPoseAvailable()
        );
    }


    function getEstimatedTimeText(
        destination
    ) {
        if (!poseIsAvailable()) {
            return UNKNOWN_TIME_TEXT;
        }

        return (
            destination.estimatedTime ??
            UNKNOWN_TIME_TEXT
        );
    }


    // ==============================
    // yaw → Quaternion
    // ==============================

    function yawToQuaternion(
        yawDegree
    ) {
        const yaw =
            Number(yawDegree);

        if (!Number.isFinite(yaw)) {
            throw new Error(
                `yawが正しい数値ではありません: ${yawDegree}`
            );
        }

        const yawRadian =
            yaw *
            Math.PI /
            180;

        return {
            x: 0.0,
            y: 0.0,
            z:
                Math.sin(
                    yawRadian / 2
                ),
            w:
                Math.cos(
                    yawRadian / 2
                )
        };
    }


    // ==============================
    // ROS Time
    // ==============================

    function createRosTime() {
        const nowMilliseconds =
            Date.now();

        return {
            sec:
                Math.floor(
                    nowMilliseconds /
                    1000
                ),

            nanosec:
                (
                    nowMilliseconds %
                    1000
                ) *
                1000000
        };
    }


    // ==============================
    // Goal Topic
    // ==============================

    function getGoalTopic() {
        if (!goalTopic) {
            goalTopic =
                new ROSLIB.Topic({
                    ros: ros,
                    name:
                        GOAL_TOPIC_NAME,
                    messageType:
                        GOAL_MESSAGE_TYPE
                });
        }

        return goalTopic;
    }


    // ==============================
    // Validate Destination
    // ==============================

    function validateDestination(
        destination,
        index
    ) {
        if (
            !destination ||
            typeof destination !==
                "object"
        ) {
            throw new Error(
                `destinations[${index}] がオブジェクトではありません`
            );
        }

        if (
            !destination.id ||
            !destination.name
        ) {
            throw new Error(
                `destinations[${index}] にidまたはnameがありません`
            );
        }

        const position =
            destination.position;

        if (
            !position ||
            !Number.isFinite(
                Number(position.x)
            ) ||
            !Number.isFinite(
                Number(position.y)
            ) ||
            !Number.isFinite(
                Number(
                    position.z ?? 0.0
                )
            )
        ) {
            throw new Error(
                `destinations[${index}] のpositionが正しくありません`
            );
        }

        if (
            !Number.isFinite(
                Number(destination.yaw)
            )
        ) {
            throw new Error(
                `destinations[${index}] のyawが正しくありません`
            );
        }
    }


    // ==============================
    // Selected Destination
    // ==============================

    function selectDestination(
        button,
        destination
    ) {
        document
            .querySelectorAll(
                ".destination"
            )
            .forEach(item => {
                item.classList.remove(
                    "active"
                );
            });

        button.classList.add(
            "active"
        );

        selectedDestinationData =
            destination;

        if (selectedDestination) {
            selectedDestination.textContent =
                destination.name;
        }

        /*
         * 目的地選択直後はmanifest.jsonの目安時間を表示。
         * 自己位置不明時は「－」を表示。
         *
         * ルート受信後はpath.jsが実際の到着予想へ
         * 自動的に書き換える。
         */
        if (selectedTime) {
            selectedTime.textContent =
                getEstimatedTimeText(
                    destination
                );
        }
    }


    // ==============================
    // Refresh Destination Times
    // ==============================

    function refreshEstimatedTimes() {
        const poseAvailable =
            poseIsAvailable();

        destinationCard
            ?.querySelectorAll(
                ".destination"
            )
            .forEach(button => {
                const destinationId =
                    button.dataset
                        .destinationId;

                const destination =
                    destinations.find(
                        item =>
                            item.id ===
                            destinationId
                    );

                if (!destination) {
                    return;
                }

                const timeElement =
                    button.querySelector(
                        ".destination-time"
                    );

                if (timeElement) {
                    timeElement.textContent =
                        getEstimatedTimeText(
                            destination
                        );
                }
            });


        /*
         * 自己位置が失われた場合は、
         * スマホの選択中表示も「－」にする。
         */
        if (
            !poseAvailable &&
            selectedTime
        ) {
            selectedTime.textContent =
                UNKNOWN_TIME_TEXT;
        }


        /*
         * 自己位置が復帰したとき、
         * 表示が「－」のままなら目安時間へ戻す。
         *
         * path.jsが実際の到着時間を表示している場合は、
         * その表示を上書きしない。
         */
        if (
            poseAvailable &&
            selectedDestinationData &&
            selectedTime
        ) {
            const currentText =
                selectedTime
                    .textContent
                    .trim();

            if (
                currentText ===
                    UNKNOWN_TIME_TEXT ||
                currentText === "--" ||
                currentText === ""
            ) {
                selectedTime.textContent =
                    getEstimatedTimeText(
                        selectedDestinationData
                    );
            }
        }
    }


    /*
     * pose.jsから自己位置状態が通知されたら、
     * 目的地一覧の時間を更新する
     */
    window.addEventListener(
        "robot-pose-status",
        refreshEstimatedTimes
    );


    // ==============================
    // Publish Goal
    // ==============================

    function publishGoal(
        destination
    ) {
        if (!destination) {
            console.error(
                "目的地データが見つかりません"
            );

            return;
        }

        if (
            !ros ||
            !ros.isConnected
        ) {
            console.warn(
                "ROSに接続されていないため、目的地を送信できません"
            );

            return;
        }

        let orientation;

        try {
            orientation =
                yawToQuaternion(
                    destination.yaw
                );
        } catch (error) {
            console.error(error);
            return;
        }

        const position =
            destination.position;

        const goalMessage =
            new ROSLIB.Message({
                header: {
                    stamp:
                        createRosTime(),

                    frame_id:
                        "map"
                },

                pose: {
                    position: {
                        x:
                            Number(
                                position.x
                            ),

                        y:
                            Number(
                                position.y
                            ),

                        z:
                            Number(
                                position.z ??
                                0.0
                            )
                    },

                    orientation:
                        orientation
                }
            });

        getGoalTopic().publish(
            goalMessage
        );

        console.log(
            `目的地を送信しました: ${destination.name}`,
            goalMessage
        );
    }


    // ==============================
    // Create Destination Button
    // ==============================

    function createDestinationButton(
        destination,
        index
    ) {
        const button =
            document.createElement(
                "div"
            );

        button.className =
            "destination";

        button.dataset.destinationId =
            destination.id;

        button.setAttribute(
            "role",
            "button"
        );

        button.setAttribute(
            "tabindex",
            "0"
        );


        const name =
            document.createElement(
                "span"
            );

        name.textContent =
            destination.name;


        const time =
            document.createElement(
                "span"
            );

        /*
         * 自己位置状態の変化時に
         * この要素だけ更新できるようクラスを付ける
         */
        time.className =
            "destination-time";

        time.textContent =
            getEstimatedTimeText(
                destination
            );


        button.append(
            name,
            time
        );


        const activate = () => {
            selectDestination(
                button,
                destination
            );

            publishGoal(
                destination
            );
        };


        button.addEventListener(
            "click",
            activate
        );


        button.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !==
                        "Enter" &&
                    event.key !==
                        " "
                ) {
                    return;
                }

                event.preventDefault();

                activate();
            }
        );


        if (index === 0) {
            selectDestination(
                button,
                destination
            );
        }

        return button;
    }


    // ==============================
    // Render Destination Buttons
    // ==============================

    function renderDestinationButtons() {
        if (!destinationCard) {
            throw new Error(
                ".destination-cardがindex.htmlにありません"
            );
        }

        destinationCard
            .querySelectorAll(
                ".destination"
            )
            .forEach(button => {
                button.remove();
            });

        document
            .getElementById(
                "destination-loading"
            )
            ?.remove();

        document
            .getElementById(
                "destination-error"
            )
            ?.remove();


        destinations.forEach(
            (
                destination,
                index
            ) => {
                destinationCard
                    .appendChild(
                        createDestinationButton(
                            destination,
                            index
                        )
                    );
            }
        );

        refreshEstimatedTimes();
    }


    // ==============================
    // Load Error
    // ==============================

    function showLoadError(
        message
    ) {
        document
            .getElementById(
                "destination-loading"
            )
            ?.remove();

        if (!destinationCard) {
            return;
        }

        const errorMessage =
            document.createElement(
                "p"
            );

        errorMessage.id =
            "destination-error";

        errorMessage.textContent =
            message;

        destinationCard.appendChild(
            errorMessage
        );

        if (selectedDestination) {
            selectedDestination.textContent =
                "読み込み失敗";
        }

        if (selectedTime) {
            selectedTime.textContent =
                UNKNOWN_TIME_TEXT;
        }
    }


    // ==============================
    // Load manifest.json
    // ==============================

    fetch(
        `${MANIFEST_PATH}?t=${Date.now()}`,
        {
            cache: "no-store"
        }
    )
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `manifest.jsonの読み込みに失敗しました: ${response.status}`
                );
            }

            return response.json();
        })
        .then(data => {
            if (
                !Array.isArray(
                    data.destinations
                )
            ) {
                throw new Error(
                    "manifest.jsonにdestinations配列がありません"
                );
            }

            if (
                data.destinations
                    .length === 0
            ) {
                throw new Error(
                    "manifest.jsonに目的地が1件もありません"
                );
            }

            data.destinations.forEach(
                validateDestination
            );

            const ids =
                data.destinations.map(
                    destination =>
                        destination.id
                );

            if (
                new Set(ids).size !==
                ids.length
            ) {
                throw new Error(
                    "manifest.jsonの目的地idが重複しています"
                );
            }

            destinations =
                data.destinations;

            renderDestinationButtons();

            console.log(
                "目的地データを読み込みました:",
                destinations
            );
        })
        .catch(error => {
            console.error(
                "goal.js エラー:",
                error
            );

            showLoadError(
                "目的地の読み込みに失敗しました"
            );
        });
}