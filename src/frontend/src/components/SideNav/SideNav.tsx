import React from 'react'
import Link from 'next/link'
import styles from './SideNav.module.css'
import Image from "next/image"
import { usePathname } from 'next/navigation'

const SideNav = () => {
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
        </nav>
    )
}

export default SideNav