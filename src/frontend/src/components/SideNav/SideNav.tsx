import React from 'react'
import Link from 'next/link'
import styles from './SideNav.module.css'
import Image from "next/image"
import { usePathname } from 'next/navigation'
import ProgressBar from '../ProgressBar'

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

type SideNavProps = {  
    progressPairs: ProgressPair[];  
};

const SideNav: React.FC<SideNavProps> = ({ progressPairs }) => {
    const pathnaem = usePathname();

    return (
        <nav className={styles.SideNav}>
            <ul className={styles.SideNavList}>
                <li>
                    <Link href="/" className={`${styles.SideNavPageLink} ${pathnaem === '/' ? styles.SideNavPageLinkActive : ''}`}>
                        <p>Home</p>
                    </Link>
                </li>
                <li>
                    <Link href="/docregistration" className={`${styles.SideNavPageLink} ${pathnaem === '/docregistration' ? styles.SideNavPageLinkActive : ''}`}>
                        <Image src="./add_file_document_icon.png" width={20} height={20} alt="add_file_document_icon"></Image>
                        <p>ドキュメント登録</p>
                    </Link>
                </li>
            </ul>
            <div className={styles.ProgressBarContainer}>
                <ul className={styles.ProgressBarList}>
                    {progressPairs.map((pair, index) => (
                        <li key={index}>
                            <ProgressBar 
                                progress={pair.progress} 
                                requestId={pair.requestId} 
                                jobType={pair.jobType}
                                bot={pair.bot}
                                isComp={pair.isComp}
                                fileName={pair.fileName}
                                failedFiles={pair.failedFiles}
                                failedFilesString={pair.failedFilesString}
                            />
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    )
}

export default SideNav