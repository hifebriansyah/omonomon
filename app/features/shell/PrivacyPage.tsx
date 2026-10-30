// The /privacy/ and /id/privacy/ page (was privacy.html): what Omon Omon stores, who processes messages, and how to delete data.
import { Link } from "react-router";
import { site } from "~/lib/content";
import { localize, useLang } from "~/lib/lang";

const UPDATED = "2026-10-31";
const H2 = "mt-7 mb-1.5 text-[1.1rem] font-bold text-text";
const TH = "border-b border-[#2c2f38] px-2 py-1.5 text-left align-top font-bold text-text";
const TD = "border-b border-[#2c2f38] px-2 py-1.5 text-left align-top text-soft";

export function PrivacyPage() {
  const lang = useLang();
  const email = site.contactEmail?.trim() || "";
  const home = localize("/", lang);

  if (lang === "id") {
    return (
      <main className="mx-auto max-w-page px-3 pt-6 pb-16 leading-[1.6] text-soft">
        <p>
          <Link to={home} className="text-link">
            &larr; Kembali ke {site.name}
          </Link>
        </p>
        <h1 className="m-0 mb-1 text-[1.6rem] font-bold text-text">Privasi</h1>
        <p className="mt-0 text-[0.85rem] text-muted">Terakhir diperbarui {UPDATED}</p>

        <p>
          {site.name} adalah proyek hobi kecil: kamu ngobrol dengan empat karakter hantu. Halaman ini menjelaskan apa yang terjadi pada datamu dengan bahasa sehari-hari.
        </p>

        <h2 className={H2}>Data yang kami proses</h2>
        <table className="w-full border-collapse text-[0.92rem]">
          <thead>
            <tr>
              <th className={TH}>Data</th>
              <th className={TH}>Untuk apa</th>
              <th className={TH}>Di mana disimpan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={TD}>Pesan obrolanmu dan balasannya</td>
              <td className={TD}>Untuk membalas pesanmu</td>
              <td className={TD}>Dikirim ke server kami, lalu ke layanan Gemini milik Google untuk menulis balasan. Riwayat obrolan juga disimpan di browsermu sendiri.</td>
            </tr>
            <tr>
              <td className={TD}>Log permintaan: waktu, halaman, jenis browser, status, karakter, alamat IP dan negara, pesan dan balasan</td>
              <td className={TD}>Memperbaiki masalah, mencegah penyalahgunaan, dan memantau biaya</td>
              <td className={TD}>Layanan log (Axiom). Disimpan selama 30 hari, lalu dihapus.</td>
            </tr>
            <tr>
              <td className={TD}>Komentar pada bisikan: nama panggilan, komentar, balasan hantu, dan ID acak dari browsermu (disimpan sebagai hash satu arah)</td>
              <td className={TD}>Menampilkan komentar, menjaga batas harian tetap adil, dan memungkinkanmu menghapus komentarmu sendiri</td>
              <td className={TD}>Database kami. Komentar bersifat publik dan dapat dihapus kapan saja dari bisikan tersebut. Gemini memeriksa setiap komentar sebelum ditampilkan.</td>
            </tr>
            <tr>
              <td className={TD}>Riwayat obrolan tersimpan</td>
              <td className={TD}>Agar obrolanmu tetap ada saat kamu kembali</td>
              <td className={TD}>Hanya di browsermu (local storage). Tombol Hapus obrolan akan menghapusnya.</td>
            </tr>
            <tr>
              <td className={TD}>Masuk dengan Google: ID akun Google, alamat email, nama, dan tautan foto profil</td>
              <td className={TD}>Mengenalimu dan menyimpan progres permainanmu</td>
              <td className={TD}>Database kami, sampai kamu menghapus akunmu.</td>
            </tr>
            <tr>
              <td className={TD}>Progres permainan (skor, lilin, level ikatan, lencana, rentetan)</td>
              <td className={TD}>Menyimpan progresmu</td>
              <td className={TD}>Browsermu, dan database kami jika kamu masuk.</td>
            </tr>
            <tr>
              <td className={TD}>Ingatan obrolan (saat masuk): catatan singkat per hantu yang ditulis oleh Gemini dari pesan terakhirmu</td>
              <td className={TD}>Agar hantu mengingatmu di berbagai perangkat</td>
              <td className={TD}>Browsermu dan database kami bersama progresmu. Dihapus bersama akunmu.</td>
            </tr>
            <tr>
              <td className={TD}>Jawaban teka-teki di Teka-Teki Gaib serta hash ID browser</td>
              <td className={TD}>Gemini menilai jawaban; hash menjaga batas harian</td>
              <td className={TD}>Dikirim ke Gemini; hash disimpan selama 2 hari.</td>
            </tr>
            <tr>
              <td className={TD}>Notifikasi (jika diaktifkan): alamat push browser, bahasa, dan tautan ke akunmu</td>
              <td className={TD}>Memberitahumu saat hantu berbisik atau rentetanmu hampir berakhir (maksimal sekali sehari)</td>
              <td className={TD}>Database kami, sampai kamu mematikan notifikasi di halaman Aku.</td>
            </tr>
            <tr>
              <td className={TD}>Error skrip dari browsermu: pesan error, file, baris, alamat halaman, dan jenis browser</td>
              <td className={TD}>Menemukan dan memperbaiki bug</td>
              <td className={TD}>Log permintaan (Axiom), 30 hari.</td>
            </tr>
            <tr>
              <td className={TD}>Papan peringkat mingguan (saat masuk): nama panggilan dan skor terbaikmu minggu ini</td>
              <td className={TD}>Menampilkan 20 besar mingguan</td>
              <td className={TD}>Database kami. Nama panggilan dan skor bersifat publik dan dihapus bersama akunmu.</td>
            </tr>
          </tbody>
        </table>

        <h2 className={H2}>Siapa lagi yang melihatnya</h2>
        <ul className="pl-5">
          <li>
            <strong>Google (Gemini)</strong> menerima pesanmu untuk menulis balasan. Jangan ketik hal yang ingin kamu rahasiakan.
          </li>
          <li>
            <strong>Cloudflare</strong> menjalankan server dan DNS kami, dan <strong>GitHub</strong> menghosting situs ini.
          </li>
          <li>
            <strong>Axiom</strong> menyimpan log permintaan di atas.
          </li>
          <li>
            <strong>Google (AdSense)</strong> menampilkan iklan di umpan bisikan. Lihat{" "}
            <a href="https://policies.google.com/technologies/partner-sites" className="text-link">
              bagaimana Google menggunakan data dari situs mitra
            </a>{" "}
            dan atur personalisasi iklan di{" "}
            <a href="https://adssettings.google.com" className="text-link">
              pengaturan iklan Google
            </a>
            .
          </li>
          <li>Kami tidak menjual datamu.</li>
        </ul>

        <h2 className={H2}>Masuk dengan Google</h2>
        <p>
          Jika kamu masuk, kami menerima ID akun Google, alamat email, nama, dan tautan foto profilmu dari Google. Kami hanya menggunakannya untuk masuk dan menyimpan progresmu.
        </p>

        <h2 className={H2}>Cookie</h2>
        <p>
          Kami menggunakan penyimpanan browser untuk obrolan dan pengaturanmu. Iklan di umpan bisikan disajikan oleh Google yang dapat menetapkan cookie periklanan sesuai persetujuanmu.
        </p>

        <h2 className={H2}>Pilihanmu</h2>
        <ul className="pl-5">
          <li>Hapus obrolan tersimpan kapan saja dari menu daftar obrolan atau dengan menghapus data situs di browsermu.</li>
          <li>Kamu dapat meminta kami mengakses, memperbaiki, atau menghapus data tentangmu.</li>
          <li>Menghapus akunmu di halaman Aku akan menghapus profil, progres, lencana, dan skor papan peringkatmu dari server kami.</li>
        </ul>

        {email && (
          <>
            <h2 className={H2}>Kontak</h2>
            <p>
              Pertanyaan atau permintaan:{" "}
              <a href={`mailto:${email}`} className="text-link">
                {email}
              </a>
              .
            </p>
          </>
        )}

        <h2 className={H2}>Untuk siapa situs ini</h2>
        <p>{site.name} tidak ditujukan untuk anak kecil. Jika kamu merasa seorang anak membagikan data pribadi, hubungi kami dan kami akan menghapusnya.</p>

        <h2 className={H2}>Perubahan</h2>
        <p>Jika ada perubahan penting, kami akan memperbarui halaman ini beserta tanggalnya.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-page px-3 pt-6 pb-16 leading-[1.6] text-soft">
      <p>
        <Link to={home} className="text-link">
          &larr; Back to {site.name}
        </Link>
      </p>
      <h1 className="m-0 mb-1 text-[1.6rem] font-bold text-text">Privacy</h1>
      <p className="mt-0 text-[0.85rem] text-muted">Last updated {UPDATED}</p>

      <p>
        {site.name} is a small hobby project: you chat with four ghost characters. This page says what happens to your data. It is written in plain words, not as legal advice.
      </p>

      <h2 className={H2}>What we handle</h2>
      <table className="w-full border-collapse text-[0.92rem]">
        <thead>
          <tr>
            <th className={TH}>Data</th>
            <th className={TH}>Why</th>
            <th className={TH}>Where it lives</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={TD}>Your chat messages and the replies</td>
            <td className={TD}>To answer you</td>
            <td className={TD}>Sent to our server, then to Google&apos;s Gemini service to write the reply. Saved chats are also kept in your own browser.</td>
          </tr>
          <tr>
            <td className={TD}>A request log: time, which page or address was requested, your browser type, status, character, your IP address and country, your message and the reply</td>
            <td className={TD}>To fix problems, stop abuse and watch costs</td>
            <td className={TD}>A logging service (Axiom). Kept for 30 days, then deleted.</td>
          </tr>
          <tr>
            <td className={TD}>Comments on whispers: your nickname, your comment, the ghost&apos;s reply, and a random id from your browser (kept only as a one-way hash)</td>
            <td className={TD}>To show the comment, keep daily limits fair and let you delete your own comment</td>
            <td className={TD}>Our database. Comments are public to every visitor and stay with their whisper. You can delete your own comment at any time, and you can ask us to remove a comment. Google&apos;s Gemini checks each comment before it is shown. You can delete your own comment from the whisper.</td>
          </tr>
          <tr>
            <td className={TD}>Saved chat history</td>
            <td className={TD}>So your chat is still there when you come back</td>
            <td className={TD}>Only in your browser (local storage). The History panel&apos;s Clear button deletes it.</td>
          </tr>
          <tr>
            <td className={TD}>Sign in with Google: your Google account id, email address, name and the link to your profile photo (the photo itself stays at Google)</td>
            <td className={TD}>To recognise you and save your game progress</td>
            <td className={TD}>Our database, until you delete your account.</td>
          </tr>
          <tr>
            <td className={TD}>Game progress (scores, candles, bond levels, badges, streak)</td>
            <td className={TD}>To save your progress</td>
            <td className={TD}>Your browser, and our database if you sign in.</td>
          </tr>
          <tr>
            <td className={TD}>Chat memory, when you are signed in: a short note per ghost (for example a name you gave and your interests), written by Google&apos;s Gemini from your recent messages</td>
            <td className={TD}>So a ghost remembers you across devices</td>
            <td className={TD}>Your browser and, with your progress, our database. It is deleted with your account. Please don&apos;t tell a ghost anything you don&apos;t want remembered.</td>
          </tr>
          <tr>
            <td className={TD}>Riddle answers you type in Teka-Teki Gaib that are not an exact match, plus a random id from your browser (kept only as a one-way hash)</td>
            <td className={TD}>Gemini judges the answer; the hash keeps the daily limit fair</td>
            <td className={TD}>Sent to Gemini; the hash is kept for 2 days.</td>
          </tr>
          <tr>
            <td className={TD}>Notifications, if you switch them on: your browser&apos;s push address, your language and (when signed in) a link to your account for streak reminders</td>
            <td className={TD}>To tell you when a ghost whispers or your streak is about to end, at most once a day</td>
            <td className={TD}>Our database, until you switch notifications off (Me page) or your browser drops the subscription.</td>
          </tr>
          <tr>
            <td className={TD}>Script errors from your browser: the message, file and line, the page address and your browser type (nothing you typed)</td>
            <td className={TD}>To find and fix bugs</td>
            <td className={TD}>The request log (Axiom), 30 days.</td>
          </tr>
          <tr>
            <td className={TD}>Weekly leaderboard, when you are signed in: your nickname and your best score per game for the week, plus a random id for each finished run (kept for a few days so one run counts once)</td>
            <td className={TD}>To show the weekly top 20</td>
            <td className={TD}>Our database. The nickname and score are public to every visitor. Google&apos;s Gemini checks a nickname before it is first shown. Scores are removed with your account.</td>
          </tr>
        </tbody>
      </table>

      <h2 className={H2}>Who else sees it</h2>
      <ul className="pl-5">
        <li>
          <strong>Google (Gemini)</strong> receives your message so it can write a reply. Please don&apos;t type anything you want to keep private.
        </li>
        <li>
          <strong>Cloudflare</strong> runs our server and DNS, and <strong>GitHub</strong> hosts this website. They see your IP address when you connect, as any website host does.
        </li>
        <li>
          <strong>Axiom</strong> stores the request log described above.
        </li>
        <li>
          <strong>Google (AdSense)</strong> shows the ads in the whispers feed. To choose and measure ads it can set cookies and read your IP address and device details. See{" "}
          <a href="https://policies.google.com/technologies/partner-sites" className="text-link">
            how Google uses data from sites that use its services
          </a>
          . You can manage ad personalisation in{" "}
          <a href="https://adssettings.google.com" className="text-link">
            Google&apos;s ad settings
          </a>
          .
        </li>
        <li>We don&apos;t sell your data.</li>
      </ul>

      <h2 className={H2}>Sign in with Google</h2>
      <p>
        If you sign in, we receive your Google account id, email address, name and the link to your profile photo from Google. We show your name and photo to you on your Me page. We use them only to log you in and to save your progress. We don&apos;t read your Gmail, Drive or contacts, and we never ask for those permissions.
      </p>

      <h2 className={H2}>Cookies</h2>
      <p>
        We use browser storage for your saved chats and settings, and, once you sign in, one cookie that keeps you signed in. The ads in the whispers feed are served by Google, which may set its own cookies for advertising (see above). Where the law requires it, Google asks for your consent first. We set no other advertising or tracking cookies.
      </p>

      <h2 className={H2}>Your choices</h2>
      <ul className="pl-5">
        <li>Delete your saved chats any time with Clear in the History panel, or by clearing this site&apos;s data in your browser.</li>
        <li>You can ask us to access, correct or delete the data we hold about you, including log lines that contain your IP address.</li>
        <li>When accounts are available, deleting your account removes your profile, progress, badges and leaderboard scores.</li>
      </ul>

      {email && (
        <>
          <h2 className={H2}>Contact</h2>
          <p>
            Questions or requests:{" "}
            <a href={`mailto:${email}`} className="text-link">
              {email}
            </a>
            .
          </p>
        </>
      )}

      <h2 className={H2}>Who this is for</h2>
      <p>{site.name} is not aimed at young children. If you think a child has shared personal data with us, contact us and we will delete it.</p>

      <h2 className={H2}>Changes</h2>
      <p>If this changes in a way that matters, we update this page and its date.</p>
    </main>
  );
}
