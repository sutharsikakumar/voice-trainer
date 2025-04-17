"use client";
import styles from "./page.module.css";
import Header from "@/components/header";
import Image from "next/image";

export default function Home() {
  return (
    <main className={styles.main}>
      <Header />

      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.logoText}>
            ba<span className={styles.x}>X</span>ter
          </h1>
          <p className={styles.subtitle}>
            Your personal speech training agent. Select an experience below.
          </p>

          <div className={styles.cardContainer}>
            <div className={styles.card}>
              <div className={styles.cardImage}>
                <Image
                  src="/images/twister.png"
                  alt="Twister Screenshot"
                  layout="fill"
                  objectFit="cover"
                />
              </div>
              <h3 className={styles.cardTitle}>
                Auto-generated tongue-twisters with personalized feedback for a quick warm-up.
              </h3>
            </div>

            <div className={styles.card}>
              <div className={styles.cardImage}>
                <Image
                  src="/images/twister.png"
                  alt="Twister Screenshot"
                  layout="fill"
                  objectFit="cover"
                />
              </div>
              <h3 className={styles.cardTitle}>
                Upload/record your speech to generate a slide presentation ensuring audiences are engaged.
              </h3>
            </div>

            <div className={styles.card}>
              <div className={styles.cardImage}>
                <Image
                  src="/images/twister.png"
                  alt="Twister Screenshot"
                  layout="fill"
                  objectFit="cover"
                />
              </div>
              <h3 className={styles.cardTitle}>
                Upload/record your speech and receive personalized feedback on how to improve delivery.
              </h3>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
