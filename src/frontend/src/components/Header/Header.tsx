import React from 'react'
import styles from './Header.module.css'

type HeaderProps = {
    title: string
}

const Header = ({ title }: HeaderProps) => {
  return (
      <header className={styles.header}>
        <h3 className={styles.headerTitleLeft}>{title}</h3>
        <h3 className={styles.headerTitleRight}>Anonymous</h3>
      </header>
  )
}

export default Header