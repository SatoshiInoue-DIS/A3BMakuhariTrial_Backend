import React from 'react'
import Link from 'next/link'
import styles from './SideNav.module.css'

const SideNav = () => {
    return (
        <nav className={styles.SideNav}>
            <ul className={styles.SideNavList}>
                <li>
                    <Link href="/" className={styles.SideNavPageLinkActive}>
                        <p>Home</p>
                    </Link>
                </li>
                <li>
                    <Link href="/docregistration" className={styles.SideNavPageLink}>
                        <p>ドキュメント登録</p>
                    </Link>
                </li>
            </ul>
        </nav>
    )
}

export default SideNav