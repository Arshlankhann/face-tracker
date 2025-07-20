import Head from 'next/head';
import FaceTracker from '../components/FaceTracker';

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Face Tracking Recorder</title>
        <meta name="description" content="Record video with a real-time face tracking overlay." />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <FaceTracker />
    </>
  );
}
