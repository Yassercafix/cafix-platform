# تقرير التشخيص الشامل — Cafix Platform
**التاريخ:** 2026-04-05  
**المُعِد:** Manus AI  
**الحالة:** مشكلة محددة — تحتاج إصلاح في الكود

---

## 1. ما تم إنجازه ✅

### أ) تهيئة Supabase Auth
- تم التحقق من وجود المستخدم `owner@cafeteria.com` في `Authentication → Users`
- تم تحديث كلمة المرور إلى `123456` عبر Supabase Admin API مباشرةً
- الحساب مؤكد (`email_confirmed_at` موجود)
- الـ UUID في Supabase Auth: `40961823-63ee-47bb-8f20-26166e837d18`

### ب) تهيئة جدول `public.users`
- تم التحقق من وجود الصف في جدول `users`
- القيم الموجودة:
  | الحقل | القيمة |
  |-------|--------|
  | `id` | `8dVb6I3Mp1UsUpOkSsJT1` |
  | `email` | `owner@cafeteria.com` |
  | `name` | `Test Owner` |
  | `role` | `owner` |
  | `openId` | `40961823-63ee-47bb-8f20-26166e837d18` |

### ج) اختبار تسجيل الدخول
- **Login endpoint** يعمل بنجاح 100%:
  - يتصل بـ Supabase Auth ✅
  - يتحقق من المستخدم في قاعدة البيانات ✅
  - يعيد `{ success: true, role: "owner", sessionToken: "..." }` ✅
  - يضبط cookie `app_session_id` ✅

---

## 2. المشكلة الحالية ❌

### الأعراض
بعد تسجيل الدخول الناجح، يبقى المستخدم في صفحة `/login` ولا يُوجَّه إلى `/dashboard/owner`.

### السبب الجذري
`authSupabase.me` يعيد **401 Unauthorized** رغم وجود token صحيح.

### تسلسل المشكلة
```
1. Login ينجح → يعيد sessionToken (JWT صحيح)
2. Frontend يحفظ التوكن في localStorage
3. Frontend يستدعي authSupabase.me مع Authorization: Bearer <token>
4. Server يستقبل الطلب في createContextSupabase()
5. verifySupabaseToken() يفشل في التحقق من الـ JWT
6. ctx.user = null
7. protectedProcedure يرمي UNAUTHORIZED
8. Frontend يبقى في صفحة login
```

### التحقق من المشكلة
تم اختبار الـ JWT token محلياً باستخدام نفس الـ embedded EC public key:
```javascript
// النتيجة محلياً:
// JWT verification SUCCESS!
// Payload email: owner@cafeteria.com
```

لكن على Vercel serverless:
```json
{"message": "Please login (10001)", "code": "UNAUTHORIZED"}
```

### السبب المرجّح
**مشكلة Vercel Serverless Cold Start مع `importJWK`**

الكود الحالي في `context-supabase.ts`:
```typescript
let _embeddedKeyPromise: Promise<KeyLike> | null = null;

function getEmbeddedKey(): Promise<KeyLike> {
  if (_embeddedKey) return Promise.resolve(_embeddedKey);
  if (!_embeddedKeyPromise) {
    _embeddedKeyPromise = importJWK(SUPABASE_EC_JWK, "ES256").then((k) => {
      _embeddedKey = k as KeyLike;
      return _embeddedKey;
    });
  }
  return _embeddedKeyPromise;
}
```

في بيئة Vercel Serverless:
- كل request قد يُنشئ instance جديد (cold start)
- `_embeddedKey` و `_embeddedKeyPromise` يُعادان إلى `null`
- `importJWK` قد يفشل أو يستغرق وقتاً طويلاً في بعض البيئات
- الـ JWKS remote call يفشل بسبب network restrictions

---

## 3. الحل المقترح 🔧

### الحل الأسرع: استخدام `SUPABASE_JWT_SECRET` (HS256)

بدلاً من EC key المعقد، يمكن استخدام الـ JWT Secret من Supabase مباشرةً.

**الخطوة 1:** احصل على `SUPABASE_JWT_SECRET` من:
```
Supabase Dashboard → Project Settings → API → JWT Settings → JWT Secret
```

**الخطوة 2:** أضفه في Vercel Environment Variables:
```
SUPABASE_JWT_SECRET = <القيمة من Supabase>
```

**الخطوة 3:** عدّل `verifySupabaseToken` في `server/_core/context-supabase.ts` ليُقدّم HS256 أولاً:

```typescript
async function verifySupabaseToken(token: string): Promise<any> {
  // ── 1. HS256 secret (الأسرع والأضمن في Vercel) ──────────────────────────
  if (process.env.SUPABASE_JWT_SECRET) {
    try {
      const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
      });
      console.log("[context] HS256 verification success for:", payload.email);
      return payload;
    } catch (e: any) {
      console.warn("[context] HS256 verification failed:", e?.message);
    }
  }

  // ── 2. Embedded EC public key ────────────────────────────────────────────
  try {
    const key = await getEmbeddedKey();
    const { payload } = await jwtVerify(token, key, { algorithms: ["ES256"] });
    console.log("[context] Embedded-key verification success for:", payload.email);
    return payload;
  } catch (e: any) {
    console.warn("[context] Embedded-key verification failed:", e?.message);
  }

  // ── 3. Remote JWKS ────────────────────────────────────────────────────────
  const jwks = getJwks();
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks, { algorithms: ["ES256"] });
      console.log("[context] JWKS verification success for:", payload.email);
      return payload;
    } catch (e: any) {
      console.warn("[context] JWKS verification failed:", e?.message);
    }
  }

  console.error("[context] All token verification methods failed");
  return null;
}
```

### الحل البديل: استخدام Supabase Admin API للتحقق

```typescript
async function verifySupabaseToken(token: string): Promise<any> {
  // استخدام Supabase Admin API للتحقق من التوكن
  if (supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        return { email: user.email, sub: user.id, ...user.user_metadata };
      }
    } catch (e: any) {
      console.warn("[context] Supabase getUser failed:", e?.message);
    }
  }
  return null;
}
```

---

## 4. خطوات التطبيق الفوري

### الخطوة 1: الحصول على JWT Secret
1. افتح [Supabase Dashboard](https://supabase.com/dashboard/project/ztamzcpkegijqcgbgtnn)
2. اذهب إلى: `Project Settings → API`
3. انسخ قيمة `JWT Secret`

### الخطوة 2: إضافة المتغير في Vercel
1. افتح [Vercel Dashboard](https://vercel.com/dashboard)
2. اختر مشروع `cafix-platform`
3. اذهب إلى: `Settings → Environment Variables`
4. أضف: `SUPABASE_JWT_SECRET = <القيمة>`
5. اضغط Save وأعد النشر (Redeploy)

### الخطوة 3: تعديل الكود
عدّل `server/_core/context-supabase.ts` كما هو موضح أعلاه.

### الخطوة 4: اختبار
```
https://cafix-platform.vercel.app/login
Email: owner@cafeteria.com
Password: 123456
```

---

## 5. ملخص الحالة

| العنصر | الحالة |
|--------|--------|
| Supabase Auth - المستخدم | ✅ موجود ومؤكد |
| كلمة المرور | ✅ `123456` |
| جدول `public.users` | ✅ صف موجود بـ `role=owner` |
| Login endpoint | ✅ يعمل |
| JWT Token | ✅ صحيح وصالح |
| `authSupabase.me` | ❌ يرفض التوكن (مشكلة Vercel) |
| التوجيه بعد Login | ❌ لا يعمل بسبب me |

---

## 6. النسخة الاحتياطية

تم حفظ نسخة احتياطية من الكود الحالي على:
```
https://github.com/Yassercafix/cafix-platform/tree/backup/2026-04-05-pre-fix
```

---

*تقرير أعده Manus AI — 2026-04-05*
