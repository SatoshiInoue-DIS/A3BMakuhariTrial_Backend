import React from "react";
import { useState, ReactNode, useEffect } from 'react';
import { useMsalAuth } from "../../auth/useMsalAuth";
import Header from "../../components/Header";
import SideNav from "../../components/SideNav";
import styles from './Layout.module.css'

interface ProgressPair {
    progress: number;
    requestId: string;
    jobType: string;
    bot: string;
    isComp: boolean;
    fileName: string;
    failedFiles?: { file: File; isUploaded: boolean }[];
    failedFilesString?: string[];
}

interface LayoutProps {  
    children: ReactNode;  
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const loginUser: Promise<string | null> = useMsalAuth();
    const [userName, setUserName] = useState<string>("anonymous");
    // 進行状況を表す
    const [progressPairs, setProgressPairs] = useState<ProgressPair[]>([]);
    // 処理が失敗したファイルを表す
    const [failedFiles, setFailedFiles] = useState<{ file: File; isUploaded: boolean }[]>([]);

    useEffect(() => {
        const fetchLoginUser = async () => {
            const result = await loginUser;
            if (result) {
                setUserName(result)
            }
        }
        fetchLoginUser(); // 非同期処理を呼び出し
    }, [loginUser]);

    const addProgressPair = (progress: number, requestId: string, jobType: string, bot: string, isComp: boolean, fileName: string, failedFiles: { file: File; isUploaded: boolean }[], failedFilesString?: string[]) => {  
        setProgressPairs(currentProgressPairs => {  
            const index = currentProgressPairs.findIndex(pair => pair.requestId === requestId);  
            if (index !== -1) {  
                // 既存の ProgressPair を更新  
                return currentProgressPairs.map((pair, idx) =>   
                    idx === index ? { ...pair, progress, jobType, bot, isComp, fileName, failedFiles, failedFilesString } : pair  
                );  
            } else {  
                // 新しい ProgressPair を追加  
                return [...currentProgressPairs, { progress, requestId, jobType, bot, isComp, fileName, failedFiles, failedFilesString }];  
            }  
        });  
    };
    
    // Clone children and pass props  
    const childrenWithProps = React.Children.map(children, child => {  
        if (React.isValidElement(child)) {  
            return React.cloneElement(child as React.ReactElement<any>, { addProgressPair });  
        }  
        return child;  
    }); 

    return (
        <div className={styles.outside}>
            <Header title="ドキュメント管理" user={userName}/>
            <div className={styles.Layout}>
                <SideNav progressPairs={progressPairs} />
                <main className={styles.LayoutMain}>
                    {childrenWithProps}
                </main>
            </div>
        </div>
    )
}

export default Layout;