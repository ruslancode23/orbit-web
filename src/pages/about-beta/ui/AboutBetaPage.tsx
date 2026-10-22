import { Link } from 'react-router'

import { env } from '@/shared/config'
import { Logo } from '@/shared/ui/logo'

/**
 * «О бете»: what this test is, what is not there yet, what the server keeps
 * and where to write. Open without a session — someone deciding whether to
 * join reads it before having an account.
 */
const AboutBetaPage = () => {
  return (
    <main className="flex min-h-dvh justify-center overflow-y-auto bg-bg p-6">
      <article className="flex w-full max-w-2xl flex-col gap-6 py-8 text-sm leading-relaxed text-fg">
        <header className="flex items-center gap-3">
          <Logo className="size-10" />
          <div>
            <h1 className="text-xl font-semibold">Orbit — закрытая бета</h1>
            <p className="text-fg-muted">Голос, экран и переписка для команд и сообществ.</p>
          </div>
        </header>

        <section aria-labelledby="beta-what" className="flex flex-col gap-2">
          <h2 id="beta-what" className="text-base font-semibold">
            Что это
          </h2>
          <p>
            Мы проверяем Orbit с небольшим кругом людей. Всё основное работает: серверы и каналы,
            сообщения с файлами и реакциями, голос и демонстрация экрана, друзья, личные сообщения и
            группы, секретные чаты. Что-то может сломаться или измениться — об этом мы скажем
            заранее.
          </p>
        </section>

        <section aria-labelledby="beta-missing" className="flex flex-col gap-2">
          <h2 id="beta-missing" className="text-base font-semibold">
            Чего пока нет
          </h2>
          <ul className="list-disc pl-5">
            <li>Восстановления пароля: запомните его или храните в менеджере паролей.</li>
            <li>Удаления аккаунта из интерфейса — напишите нам, удалим вручную.</li>
            <li>Приложения для компьютера: Orbit работает в браузере и ставится как PWA.</li>
          </ul>
        </section>

        <section aria-labelledby="beta-data" className="flex flex-col gap-2">
          <h2 id="beta-data" className="text-base font-semibold">
            Какие данные мы храним
          </h2>
          <ul className="list-disc pl-5">
            <li>
              Аккаунт: ник, почту (если указали) и пароль — только в виде хэша, сам пароль не
              хранится.
            </li>
            <li>
              Профиль, серверы, каналы, сообщения и файлы — на нашем сервере, пока вы их не удалите.
            </li>
            <li>
              Секретные чаты — только зашифрованными: прочитать их могут лишь устройства
              собеседников, а сервер держит конверты не дольше недели.
            </li>
            <li>Голос и экран не записываются.</li>
            <li>Кто в сети, сервер знает только пока вы подключены, и нигде это не сохраняет.</li>
          </ul>
        </section>

        <section aria-labelledby="beta-feedback" className="flex flex-col gap-2">
          <h2 id="beta-feedback" className="text-base font-semibold">
            Нашли ошибку или есть идея
          </h2>
          {env.feedbackUrl ? (
            <p>
              Напишите нам:{' '}
              <a
                href={env.feedbackUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline underline-offset-2"
              >
                обратная связь
              </a>
              . Расскажите, что делали и что увидели — скриншот очень помогает.
            </p>
          ) : (
            <p>
              Расскажите тому, кто пригласил вас в бету: что делали и что увидели — скриншот очень
              помогает.
            </p>
          )}
        </section>

        <p>
          <Link to="/" className="text-accent underline underline-offset-2">
            Вернуться в Orbit
          </Link>
        </p>
      </article>
    </main>
  )
}

export default AboutBetaPage
