import styles from './ProgressBar.module.css'
import React, { useState, useEffect, useCallback } from 'react';
import { uploadApi, checkProgress, deleteApi } from "../../api";

type Props = {
    progress: number;
    requestId: string;
    jobType: string;
    bot: string;
    isComp: boolean;
    fileName: string;
    failedFiles?: { file: File; isUploaded: boolean }[] | undefined;
    failedFilesString?: string[] | undefined;
};

const ProgressBar: React.FC<Props> = ({ progress, requestId, jobType, bot, isComp, fileName, failedFiles, failedFilesString }) => {
    const [jobProgress, setJobProgress] = useState<number>(0);
    const [currentShowFiles, setCurrentShowFiles] = useState<{ file: File; isUploaded: boolean }[]>();
    const [currentShowFileNames, setCurrentShowFileName] = useState<string[]>();
    const [job, setJob] = useState<string>(jobType);
    const [isComplition, setIsComplition] = useState<boolean>(isComp);
    const [retry, setRetry] = useState<boolean>(false);
    const [isVisible, setIsVisible] = useState(true);

    let job_type: string;

    let indication: string;
    if (job === `upload`) {
        job_type = `アップロード`;
        indication = `${bot}に${fileName} 等を`
    } else if (job === `reupload` ) {
        job_type = `アップロード`;
        indication = `再度${bot}に${fileName} 等を`
    } else if (job === `delete` ) {
        job_type = `削除`;
        indication = `${bot}から${fileName} 等を`
    } else if (job === `oneDelete`) {
        job_type = `削除`;
        indication = `${bot}から${fileName} を`
    } else if (job === `reDelete`) {
        job_type = `削除`;
        indication = `再度${bot}から${fileName} 等を`
    } else if (job === `reOneDelete`) {
        job_type = `削除`;
        indication = `再度${bot}から${fileName} を`
    } else {
        job_type = ``;
        indication = ``;
    }
    
    const makeApiRequest = async () => {
        setJobProgress(0.0);
        setIsComplition(false);
        setRetry(true);
        try {
            if (job === "upload" || "reupload") {
                const formData = new FormData();
                const job_type = "reupload";
                setJob(job_type);
                const retry_id = requestId;
                if (currentShowFiles && currentShowFiles.length > 0) {
                    currentShowFiles.forEach((fileInfo) => {
                        formData.append("file", fileInfo.file);
                        formData.append("bot", bot);
                        formData.append("upload_id", retry_id);
                    });
                    // 1番目のfileの値を取得
                    const first_file_name = currentShowFiles.length > 0 ? currentShowFiles[0].file.name : "";
                    // 進行状況の確認を開始
                    const checkProgressPromise = checkProgress(retry_id, (newProgress: number) => {  
                        setJobProgress(newProgress);
                    });
                    const response = await uploadApi(formData);
                    // checkProgressPromiseの結果を待つ
                    const progressResult = await checkProgressPromise;
                    const { progress, isComp, failed_files } = progressResult;
                    // 進行状況が100未満かつ、失敗したファイルが存在するかを確認
                    if (progress < 100 && failed_files && failed_files.length > 0) {
                        // また失敗したファイルがあれば
                        const failedfiles = failed_files || [];
                        if (failedfiles.length > 0) {
                            const failedFileObjects = currentShowFiles.filter(fileInfo =>
                                failedfiles.some(failedFile => failedFile === fileInfo.file.name)
                            );
                            // 失敗したファイルを更新
                            setCurrentShowFiles(failedFileObjects); 
                        }
                    }
                    // 失敗したファイルがなければ
                    setCurrentShowFiles(undefined);
                }
            } else if (job === "delete" || "oneDelete" || "reDelete" || "reOneDelete") {
                const job_type = (job === "delete") ? "reDelete" : "reOneDelete"
                setJob(job_type);
                const retry_id = requestId;
                if(currentShowFileNames && currentShowFileNames.length > 0) {
                    // fileの名前を取得
                    const file_name = currentShowFileNames.length > 0 ? currentShowFileNames[0] : "";
                    // 進行状況の確認を開始
                    const checkProgressPromise = checkProgress(retry_id, (newProgress: number) => {  
                        setJobProgress(newProgress);
                    });
                    const filenames = [];
                    for (const filename of currentShowFileNames) {
                        filenames.push({filename: filename})
                    }
                    const response = await deleteApi(filenames, bot, retry_id);
                    // checkProgressPromiseの結果を待つ
                    const progressResult = await checkProgressPromise;
                    const { progress, isComp, failed_files } = progressResult;
                    // 進行状況が100未満かつ、失敗したファイルが存在するかを確認
                    if (progress < 100 && failed_files && failed_files.length > 0) {
                        // また失敗したファイルがあれば
                        const failed_files_string = failed_files || [];
                        // 失敗したファイルを更新
                        setCurrentShowFileName(failed_files_string)
                    }
                    // 失敗したファイルがなければ
                    setCurrentShowFileName(undefined)
                }
            }
        setRetry(false);
        setIsComplition(isComp);
        } catch (e) {
            alert(`再試行中にエラーが発生しました: ${e}`);
        } finally {
        }
    };

    useEffect(() => {
        setJobProgress(progress);
    }, [progress]);

    useEffect(() => {
        setIsComplition(isComp);
    }, [isComp]);

    useEffect(() => {
        setCurrentShowFileName(failedFilesString);
    }, [failedFilesString]);

    useEffect(() => {
        setCurrentShowFiles(failedFiles);
    }, [failedFiles]);

    const handleClose = () => {
        setIsVisible(false);  // ボタンがクリックされたら、非表示にする
    };

    const handleCansel = async () => {
        try {
          const response = await fetch(`/cancel/${requestId}`, {
              method: "POST",
          });
          if (response.ok) {
             console.log("Task cancelled");
          }
        } catch (error) {
            console.error("Error cancelling task", error);
        }
    };
    
    return (
        <>
        {isVisible && (
            !isComplition && !currentShowFiles ? (
                // 処理を実行中
                <div className={styles.ProgressBarContainer}
                    style={{ backgroundColor: '#fff' }}
                >
                    <div className={styles.ProgressBarExplain}>
                        <div className={styles.Explain1}>
                            <p>{indication}</p>
                            <p>{`${job_type} しています`}</p>
                        </div>
                        <div className={styles.Explain2}>
                            <p>{`現在 ${jobProgress}%`}</p>
                        </div>
                    </div>
                    <div className={styles.ProgressBarSet}>
                        <div className={styles.ProgressBarRange}>
                            <div className={styles.ProgressBar}
                                style={{
                                    width: `${jobProgress}%`,
                                    backgroundColor: '#3b82f6'
                                }}
                            />
                        </div>
                        <div className={styles.ProgressBarBtn}>
                            <button onClick={handleCansel}>Cancel</button>
                        </div>
                    </div>
                </div>
            ) : isComplition && !currentShowFiles ? (
                // 処理が成功
                <div className={styles.ProgressBarContainer}
                    style={{ backgroundColor: '#E9F3FF' }}
                >
                    <div className={styles.ProgressBarExplain}>
                        <div className={styles.Explain1}>
                            <p>{indication}</p>
                            <p>{`${job_type} が完了しました`}</p>
                        </div>
                        <div className={styles.Explain2}>
                            <p>{`${jobProgress}%`}</p>
                        </div>
                    </div>
                    <div className={styles.ProgressBarSet}>
                        <div className={styles.ProgressBarRange}>
                            <div className={styles.ProgressBar}
                                style={{
                                    width: `${jobProgress}%`,
                                    backgroundColor:'#4caf50'
                                }}
                            />
                        </div>
                        <div className={styles.ProgressBarBtn}>
                            <button onClick={handleClose}>OK</button>
                        </div>
                    </div>
                </div>
            ) : isComplition && currentShowFiles ? (
                // 処理が失敗
                <div className={styles.ProgressBarContainer}
                    style={{ backgroundColor: '#FFE1E1' }}
                >
                    <div className={styles.ProgressBarExplain}>
                        <div className={styles.Explain1}>
                            <p>{indication}</p>
                            <p>{`${job_type} が失敗しました`}</p>
                        </div>
                        <div className={styles.Explain2}>
                            <p>{`現在 ${jobProgress}%`}</p>
                        </div>
                    </div>
                    <div className={styles.ProgressBarSet}>
                        <div className={styles.ProgressBarRange}>
                            <div className={styles.ProgressBar}
                                style={{
                                    width: `${jobProgress}%`,
                                    backgroundColor:'#FF7474'
                                }}
                            />
                        </div>
                        <div className={styles.ProgressBarBtn}>
                            <button onClick={makeApiRequest}>Retry</button>
                        </div>
                    </div>
                </div>
            ) : retry && !isComplition && currentShowFiles ? (
                // 再実行
                <div className={styles.ProgressBarContainer}
                    style={{ backgroundColor: '#fff' }}
                >
                    <div className={styles.ProgressBarExplain}>
                        <div className={styles.Explain1}>
                            <p>{indication}</p>
                            <p>{`${job_type} します`}</p>
                        </div>
                        <div className={styles.Explain2}>
                            <p>{`現在 ${jobProgress}%`}</p>
                        </div>
                    </div>
                    <div className={styles.ProgressBarSet}>
                        <div className={styles.ProgressBarRange}>
                            <div className={styles.ProgressBar}
                                style={{
                                    width: `${jobProgress}%`,
                                    backgroundColor:'#4caf50'
                                }}
                            />
                        </div>
                        <div className={styles.ProgressBarBtn}>
                            <button onClick={handleCansel}>Cancel</button>
                        </div>
                    </div>
                </div>
            ) : (
                // 
                <div className={styles.ProgressBarContainer}
                    style={{ backgroundColor: '#fff' }}
                >
                    {/* <div className={styles.ProgressBarExplain}>
                        <div className={styles.Explain1}>
                            <p>{indication}</p>
                            <p>{`${job_type} が完了しました`}</p>
                        </div>
                        <div className={styles.Explain2}>
                            <p>{`現在 ${progress}%`}</p>
                        </div>
                    </div>
                    <div className={styles.ProgressBarSet}>
                        <div className={styles.ProgressBarRange}>
                            <div className={styles.ProgressBar}
                                style={{
                                    width: `${progress}%`,
                                    backgroundColor:'#4caf50'
                                }}
                            />
                        </div>
                        { progress === 0 ? (
                            <div className={styles.ProgressBarBtn}>
                                <button onClick={makeApiRequest}>再試行</button>
                            </div>
                        ) : 0 < progress && progress < 100 ? (
                            currentShowFiles ? (
                                <div className={styles.ProgressBarBtn}>
                                    <button onClick={makeApiRequest}>再試行</button>
                                </div>
                            ) : (
                                <div className={styles.ProgressBarBtn}>
                                    <button id="">Cancel</button>
                                </div>
                            )
                        ) : progress === 100 ? (
                            <div className={styles.ProgressBarBtn}>
                                <button id="">OK</button>
                            </div>
                        ) : (
                            <div className={styles.ProgressBarBtn}>
                                <button id="">miss</button>
                            </div>
                        )}
                    </div> */}
                </div>
            )
        )}
        </>
    );
};

export default ProgressBar