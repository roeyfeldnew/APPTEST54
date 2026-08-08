```js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function publicPhotoUrl(storagePath) {
  if (!storagePath) return "";

  const { data } = supabase.storage
    .from("photos")
    .getPublicUrl(storagePath);

  return data.publicUrl;
}
```
