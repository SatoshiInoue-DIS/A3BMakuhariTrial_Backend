import React from 'react'
import styles from './Header.module.css'

type HeaderProps = {
    title: string;
    user: string;
}

const Header = ({ title, user }: HeaderProps) => {
  return (
      <header className={styles.header}>
        <h3 className={styles.headerTitleLeft}>{title}</h3>
        <h3 className={styles.headerTitleRight}>{user}</h3>
      </header>
  )
}

export default Header