NEON SPIN — виправлення permission-denied (створення приватного чату)

ЗАМІНИТИ У КОРЕНІ GITHUB РЕПОЗИТОРІЮ:
- app.js
- sw.js

Важливо: ці файли мають лежати поруч із index.html, не в новій підпапці.
Зробити Commit changes та дочекатися публікації GitHub Pages.
На ПК: Chrome -> F12 -> Application -> Service Workers -> Unregister; Storage -> Clear site data; Ctrl+Shift+R.

Проблема: у старому app.js перед створенням приватного чату викликався getDoc(chatRef), але правила Firestore забороняють читання відсутніх чатів. Це викликало permission-denied.

Виправлення: перевірка уже відкритих чатів зі списку доступних користувачу, потім setDoc для нового чату, і лише у випадку помилки — спроба прочитати наявний документ.

Надані користувачем правила Firestore виглядають сумісними із записом нового чату. Їх не потрібно відкривати для всіх. Перевірити, що правила дійсно опубліковані в Firebase -> Firestore Database -> Rules -> Publish, у правильній базі (default).

Перевірка: Github -> app.js у головній гілці НЕ має містити 'const existing=await getDoc(chatRef);' ДО setDoc у createForm. Якщо помилка залишилась, надати Console FirebaseError з точним кодом.
