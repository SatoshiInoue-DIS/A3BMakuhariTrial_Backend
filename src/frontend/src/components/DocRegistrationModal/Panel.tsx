import React from "react";
import { useState, useCallback } from "react";
import Style from "./Panel.module.css";
import type { NextPage } from "next";
import { useDropzone } from "react-dropzone";
import type { FileRejection } from "react-dropzone";
import File from "public/file.svg";
import Trash from "public/trash.svg";
import Image from "next/image";
import { UploadRequest, uploadApi } from "../../api";


type Props = {
    close?: (e: any) => void;
    bot: string;
};

const Panel: NextPage<Props> = (props) => {
    const submit = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (props.close) {
            props.close(e);
        }
    };

    const [currentShowFiles, setCurrentShowFiles] = useState<{ file: File; isUploaded: boolean }[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);


    const onUploadFile = async (file: File) => {
        try {
            setCurrentShowFiles((prevFiles) => [
                ...prevFiles,
                { file, isUploaded: false },
            ]);
            const uploadTime = Math.random(); // 1秒から10秒
            await new Promise((resolve) => setTimeout(resolve, uploadTime));
            setCurrentShowFiles((prevFiles) =>
                prevFiles.map((f) =>
                f.file.name === file.name ? { ...f, isUploaded: true } : f,
                ),
            );
        } catch (error) {
            // ↓ここでエラーに関するユーザーへの通知や処理を行う
            alert(`アップロード中にエラーが発生しました: ${error}`);
        }
    };
    
    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {

            // ドロップしたファイルの中で、現在表示されているファイルと重複しているもの( filename と size が同じファイル)を除外する。
            const filteringFiles = acceptedFiles.filter(
                (file) =>
                !currentShowFiles?.find(
                    (showFile) =>
                    file.name === showFile.file.name &&
                    file.size === showFile.file.size,
                ),
            );

            // ドロップしたファイルと現在表示されているファイルの合計が 10 を超える場合、追加を許可しない。
            if (filteringFiles.length + currentShowFiles.length > 10) {
                alert("最大10ファイルまでアップロードできます。");
                return;
            }

            // アップロード可能なファイルが存在する場合、アップロード中のスイッチを true にし、アップロードを開始する
            if (filteringFiles.length) {
                try {
                    await Promise.all(filteringFiles.map((file) => onUploadFile(file)));
                    // ↓すべてのファイルのアップロードが成功した後の処理を書く


                    // const formData = new FormData();

                    // filteringFiles.forEach((file) => {
                    //     formData.append("file", file)
                    //     console.log(formData.entries())
                    // })

                } catch (error) {
                    // ↓ここでエラーに関するユーザーへの通知や処理を行う
                    alert(`アップロード中にエラーが発生しました: ${error}`);
                }
            }
        },
        [currentShowFiles],
    );

    const onDropRejected = useCallback((rejectedFiles: FileRejection[]) => {
        rejectedFiles.forEach(({ file, errors }) => {
            errors.forEach(({ code }) => {
                let message = "エラーが発生しました。";
                switch (code) {
                    case "file-too-large":
                        message = `${file.name} のファイルサイズが大きすぎます。100MB以下のファイルをアップロードしてください。`;
                        break;
                    case "file-invalid-type":
                        message = `${file.name} のファイル形式が許可されていません。許可されているファイル形式は jpg, jpeg, png, pdf, doc, docx, xls, xlsx, ppt, pptx, txt です。`;
                        break;
                    default:
                        break;
                }
                alert(message);
            });
        });
    }, []);

    const { getRootProps, getInputProps, isDragAccept, isDragReject } =
        useDropzone({
            onDrop,
            onDropRejected,
            accept: {
                // 画像
                "image/jpeg": [],
                "image/png": [],
                // テキスト
                "text/plain": [],
                // PDF
                "application/pdf": [],
                // ワード
                "application/msword": [],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [],
                // パワーポイント
                "application/vnd.ms-powerpoint": [],
                "application/vnd.openxmlformats-officedocument.presentationml.presentation": [],
                // エクセル
                "application/vnd.ms-excel": [],
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [],

            },
            maxSize: 100 * 1024 * 1024, // 100MB
        });

    // ドラッグ中のスタイルを設定
    const setDropZoneStyle = () => {
        if (isDragAccept) {
            return Style.is_drag_accept;
        } else if (isDragReject) {
            return Style.is_drag_reject;
        } else {
            return "";
        }
    };

    const removeFile = (index: number) => {
        const filteringFiles = currentShowFiles.filter(
            (_, i) => i !== index,
        );
        setCurrentShowFiles(filteringFiles);
    };

    const [uploadComp, setUploadComp] = useState<boolean>(false);

    const makeApiRequest = async () => {
        setIsLoading(true);
        try {
            const formData = new FormData();
            currentShowFiles.forEach((fileInfo) => {
                formData.append("file", fileInfo.file);
                formData.append("bot", props.bot);
            });
            const response = await uploadApi(formData);
            
            setUploadComp(response.answer);
            setIsLoading(false);
        } catch (e) {
            // setError(e);
            alert(`アップロード中にエラーが発生しました: ${e}`);
            setIsLoading(false);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className={Style.wrapper}>
            {!uploadComp ? (
                <>
                    {isLoading ? (
                        <>
                            <div>
                                <p>アップロード中です。</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <header className={Style.modalPanelHeader}>
                                    <h3>ファイルのアップロード</h3>
                                    <p>{props.bot}</p>
                                    <button type="button" onClick={props.close}>×</button>
                                </header>
                                <div
                                    {...getRootProps()}
                                    className={`${Style.file_upload} ${setDropZoneStyle()}`}
                                >
                                    <input {...getInputProps()} />
                                    <p className={Style.file_name}>
                                        {isDragAccept
                                            ? "ファイルをアップロードします。"
                                            : isDragReject
                                                ? "エラー"
                                                : "ファイルを登録してください。"
                                        }
                                    </p>
                                    <p>
                                        {isDragReject
                                            ? "このファイル形式のアップロードは許可されていません。"
                                            : "ファイルを選択するか、ドラッグアンドドロップ（複数選択可）してください。"
                                        }
                                    </p>
                                    <button disabled={isDragReject}>ファイルを選択</button>
                                </div>
                                <p className={Style.note}>*アップロード可能なファイル形式（*.pdf、*.doc、*.docx、*.xls、*.xlsx、*.ppt、*.pptx、*.txt、*.png、*.jpg、*.jpeg）</p>
                                <p className={Style.caution}>*1ファイルサイズの上限は100MBまでです。</p>
                                <p className={Style.note}>*Excelファイルを登録する場合、印刷時のページ設定をしてから登録させてください。</p>
                                <p className={Style.note}>*パスワードで保護されたドキュメントは登録できますが、回答には反映されません。</p>
                                <p className={Style.note}>*ファイルを登録してからBotの応答に反映されるまでに、10分前後かかります。</p>
                            </div>
                            {currentShowFiles && (
                                <aside>
                                    <ul className={Style.file}>
                                        {currentShowFiles.map((item, index) => (
                                            <li key={index} className={Style.file_list}>
                                                {item.isUploaded ? (
                                                    <div className={Style.file_item}>
                                                        <div className={Style.file_item_type}>
                                                            <span className={Style.icon_file}>
                                                                <File />
                                                            </span>
                                                        </div>
                                                        <div className={Style.file_item_body}>
                                                            <p className={Style.file_item_name}>{item.file.name}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className={Style.file_item_trash}
                                                            onClick={() => {
                                                                removeFile(index);
                                                            }}
                                                        >
                                                            <span className={Style.icon_trash}>
                                                                <Trash />
                                                            </span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className={Style.file_item}>
                                                        <div className={Style.file_item_type}>
                                                            <Image
                                                                src="/spinner.gif"
                                                                width={20}
                                                                height={20}
                                                                alt="loading"
                                                                unoptimized={true}
                                                            />
                                                        </div>
                                                        <div className={Style.file_item_body}>
                                                            <p className={Style.file_item_name}>
                                                                {item.file.name}をアップロードしています…
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </aside>
                            )}
                            <footer className={Style.FileUploadBtnArea}>
                                <button onClick={makeApiRequest}>ファイルのアップロード</button>
                            </footer>
                        </>
                    )}
                </>
            ) : (
                <>
                    <p>登録が完了しました。</p>
                    <button type="button" onClick={props.close}>OK</button>
                </>
            )}
        </div>
    );
};

export default Panel;