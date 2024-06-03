import react from "react";
import Header from "../../components/Header";
import SideNav from "../../components/SideNav";
import Footer from "../../components/Footer";
import styles from './Layout.module.css'

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div>
            <Header title="A3BBot管理画面" />
            <div className={styles.Layout}>
                <SideNav />
                <main className={styles.LayoutMain}>
                    {children}
                </main>
            </div>
        </div>
    )
}

export default Layout;