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
};

const Panel: NextPage<Props> = (props) => {
    const submit = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (props.close) {
            props.close(e);
        }
    };


    const [currentShowFiles, setCurrentShowFiles] = useState<{ file: File; isUploaded: boolean }[]>([]);

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
                        message = `${file.name} のファイル形式が許可されていません。許可されているファイル形式は jpg, png, pdf, doc, docx, xls, xlsx, ppt, pptx です。`;
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
                "image/jpeg": [],
                "image/png": [],
                "application/pdf": [],
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









    const makeApiRequest = async () => {
        try {
            const formData = new FormData();
            currentShowFiles.forEach((fileInfo) => {
                formData.append("file", fileInfo.file);
            });
            const response = await uploadApi(formData);
            // ファイル情報をAPIリクエストに含める
            // const requests = formData.map(fileInfo => ({
                // file_name: fileInfo.file.name,
                // file_path: fileInfo.filePath
                // file_data: fileInfo.file
            // }));
            // バックエンドに一括送信
            // const results = await Promise.all(requests.map(request => uploadApi(request)));
            // 結果を処理する
            // console.log(response);
            // const request: UploadRequest = {
            //     file_name: currentShowFiles[0].file.name,
            //     file_path: currentShowFiles[0].file.name
            // };
            // const result = await uploadApi(request);
            // setUploadComp(result.answer);
        } catch (e) {
            // setError(e);
            alert(`アップロード中にエラーが発生しました: ${e}`);
        } finally {
            // setIsLoading(false);
        }
    };


    return (
    //     <section className={Style.modalPanel}>
    //         <header className={Style.modalPanelHeader}>
    //             <h3>ファイルのアップロード</h3>
    //             <button type="button" onClick={props.close}>×</button>
    //         </header>
    //         <div className={Style.dropArea}>
    //             <div className={Style.dropAreaTop}>
    //                 <h3>
    //                     ここにファイルをドラッグ＆ドロップ（複数選択可）<br/>
    //                     または
    //                 </h3>
    //                 <div>
    //                     <input type="file" />
    //                 </div>
    //             </div>
    //             <div>
    //                 <div className={Style.dropAreaNotes}>
    //                     <p>*アップロード可能なファイル形式（*.pdf、*.doc、*.docx、*.xls、*.xlsx、*.ppt、*.pptx）</p>
    //                     <p>*1ファイルサイズの上限は100MBまでです。</p>
    //                     <p>*パスワードで保護されたドキュメントは登録できますが、回答には反映されません。</p>
    //                     <p>*ファイルを登録してからBotの応答に反映されるまでに、10分前後かかります。</p>
    //                 </div>
    //             </div>
    //         </div>
    //         <footer className={Style.FileUploadBtnArea}>
    //             <button type="submit" onClick={submit}>ファイルのアップロード</button>
    //         </footer>
    //     </section>
    // );
        <div className={Style.wrapper}>
            <div>
                <header className={Style.modalPanelHeader}>
                    <h3>ファイルのアップロード</h3>
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
                    <p className={Style.file_name}>
                        {isDragReject
                            ? "このファイル形式のアップロードは許可されていません。"
                            : "ファイルを選択するか、ドラッグアンドドロップ（複数選択可）してください。"
                        }
                    </p>
                    <button disabled={isDragReject}>ファイルを選択</button>
                </div>
                <p className={Style.note}>*アップロード可能なファイル形式（*.pdf、*.doc、*.docx、*.xls、*.xlsx、*.ppt、*.pptx）</p>
                <p className={Style.caution}>*1ファイルサイズの上限は100MBまでです。</p>
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
        </div>
    );
};

export default Panel;