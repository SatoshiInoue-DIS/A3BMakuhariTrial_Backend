import React, { useState } from "react";
import Portal from "./Portal";
import Style from "./Modal.module.css";

type Props = {
    close: (e: any) => void;  // toggleModal を受け取る
    children: React.ReactNode;  // 子コンポーネントを受け取る
};

const Modal: React.FC<Props> = props => {
    const [isMouseDown, setIsMouseDown] = useState(false);

    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            setIsMouseDown(true);
        }
    };

    const onMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isMouseDown) {
            props.close(e);
        }
        setIsMouseDown(false);
    };

    return (
        <Portal>
            <div
                className={Style.modal}
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
            >
                <div className={Style.modalArea}>
                    {React.cloneElement(props.children as any, {
                        close: props.close
                    })}
                </div>
            </div>
        </Portal>
    );
}
export default Modal;