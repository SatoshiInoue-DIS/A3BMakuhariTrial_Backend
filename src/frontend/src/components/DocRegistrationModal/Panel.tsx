import React from "react";
import Style from "./Panel.module.css";


type Props = {
    close?: (e: any) => void;
};

const Panel: React.FC<Props> = props => {
    const submit = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (props.close) {
            props.close(e);
        }
    };

    return (
        <section className={Style.modalPanel}>
            <header className={Style.modalPanelHeader}>
                <h3>ファイルのアップロード</h3>
                <button type="button" onClick={props.close}>×</button>
            </header>
            <div className={Style.dropArea}>
                <div className={Style.dropAreaTop}>
                    <h3>
                        ここにファイルをドラッグ＆ドロップ（複数選択可）<br/>
                        または
                    </h3>
                    <div>
                        <input type="file" />
                    </div>
                </div>
                <div>
                    <div className={Style.dropAreaNotes}>
                        <p>*アップロード可能なファイル形式（*.pdf、*.doc、*.docx、*.xls、*.xlsx、*.ppt、*.pptx）</p>
                        <p>*1ファイルサイズの上限は100MBまでです。</p>
                        <p>*パスワードで保護されたドキュメントは登録できますが、回答には反映されません。</p>
                        <p>*ファイルを登録してからBotの応答に反映されるまでに、10分前後かかります。</p>
                    </div>
                </div>
            </div>
            <footer className={Style.FileUploadBtnArea}>
                <button type="submit" onClick={submit}>ファイルのアップロード</button>
            </footer>
        </section>
    );
};

export default Panel;