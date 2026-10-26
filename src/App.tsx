/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpeningScreen } from './components/OpeningScreen';
import { MediaLibraryProvider } from './context/MediaLibraryContext';
import { AlarmProvider } from './context/AlarmContext';

export default function App() {
  return (
    <MediaLibraryProvider>
      <AlarmProvider>
        <main className="w-full h-screen bg-black overflow-hidden font-sans">
          <OpeningScreen />
        </main>
      </AlarmProvider>
    </MediaLibraryProvider>
  );
}
