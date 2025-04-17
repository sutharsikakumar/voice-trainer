"use client";

import Link from 'next/link';
import styles from './header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <Link href="/">
          <span className={styles.logoText}>b<span className={styles.x}>X</span>t</span>
        </Link>
      </div>
      <nav className={styles.nav}>
        <Link href="/twister" className={styles.navLink}>Twister</Link>
        <Link href="/presenter" className={styles.navLink}>Presenter</Link>
      </nav>
    </header>
  );
}