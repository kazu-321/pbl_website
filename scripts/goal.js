// ==============================
// Goal Publisher
// manifest.json の yaw から向きを計算し、
// /goal_pose に PoseStamped を送信する
// ==============================

function initializeGoalPublisher(ros) {

    const MANIFEST_PATH = "./manifest.json";

    const GOAL_TOPIC_NAME =
        "/goal_pose";

    const GOAL_MESSAGE_TYPE =
        "geometry_msgs/msg/PoseStamped";


    let destinations = [];

    let goalTopic = null;


    // ==============================
    // yawをQuaternionへ変換
    // ==============================

    function yawToQuaternion(yawDegree) {

        const yaw =
            Number(yawDegree);


        if (!Number.isFinite(yaw)) {

            throw new Error(
                `yawが正しい数値ではありません: ${yawDegree}`
            );
        }


        // 度からラジアンへ変換
        const yawRadian =
            yaw * Math.PI / 180;


        return {

            x: 0.0,

            y: 0.0,

            z: Math.sin(
                yawRadian / 2
            ),

            w: Math.cos(
                yawRadian / 2
            )
        };
    }


    // ==============================
    // 現在時刻をROS 2形式に変換
    // ==============================

    function createRosTime() {

        const nowMilliseconds =
            Date.now();


        return {

            sec: Math.floor(
                nowMilliseconds / 1000
            ),

            nanosec:
                (nowMilliseconds % 1000)
                * 1000000
        };
    }


    // ==============================
    // Goal Topic作成
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
    // 押されたボタンに対応する目的地を取得
    // ==============================

    function findDestination(button) {

        const destinationId =
            button.dataset.destinationId;


        // data-destination-idがある場合
        if (destinationId) {

            return destinations.find(

                destination =>
                    destination.id
                    === destinationId
            );
        }


        // data-destination-idがない場合は
        // ボタンに表示されている名前で検索
        const nameElement =
            button.querySelector("span");


        const buttonName =
            nameElement

                ? nameElement.textContent.trim()

                : button.textContent.trim();


        return destinations.find(

            destination =>
                destination.name
                === buttonName
        );
    }


    // ==============================
    // 目的地を送信
    // ==============================

    function publishGoal(destination) {

        if (!destination) {

            console.error(
                "目的地データが見つかりません"
            );

            return;
        }


        if (!ros || !ros.isConnected) {

            console.warn(
                "ROSに接続されていないため、目的地を送信できません"
            );

            return;
        }


        const position =
            destination.position;


        if (
            !position
            || !Number.isFinite(
                Number(position.x)
            )
            || !Number.isFinite(
                Number(position.y)
            )
        ) {

            console.error(
                "目的地のpositionが正しくありません:",
                destination
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
                            Number(position.x),

                        y:
                            Number(position.y),

                        z:
                            Number(
                                position.z ?? 0.0
                            )
                    },

                    orientation: {

                        x:
                            orientation.x,

                        y:
                            orientation.y,

                        z:
                            orientation.z,

                        w:
                            orientation.w
                    }
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
    // 目的地ボタンの設定
    // ==============================

    function setupDestinationButtons() {

        const buttons =
            document.querySelectorAll(
                ".destination"
            );


        buttons.forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const destination =
                        findDestination(
                            button
                        );


                    publishGoal(
                        destination
                    );
                }
            );


            // EnterキーまたはSpaceキーでも送信
            button.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key !== "Enter"
                        && event.key !== " "
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const destination =
                        findDestination(
                            button
                        );


                    publishGoal(
                        destination
                    );
                }
            );
        });
    }


    // ==============================
    // manifest.json読み込み
    // ==============================

    fetch(MANIFEST_PATH)

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


            destinations =
                data.destinations;


            setupDestinationButtons();


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
        });
}