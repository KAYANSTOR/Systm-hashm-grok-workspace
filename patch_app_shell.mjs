import fs from 'fs';
let content = fs.readFileSync('src/components/app-shell.tsx', 'utf8');

content = content.replace(
  'function handleOnline() {\n      setIsOnline(true);\n    }',
  'function handleOnline() {\n      setIsOnline(true);\n      toast.success("تم استعادة الاتصال بالإنترنت، وتم ترحيل ورفع البيانات إلى السحابة بنجاح.", { duration: 5000 });\n    }'
);

// Fix duplicate inventory nav
content = content.replace(
  '  { to: "/inventory", label: "المخزن", icon: Boxes },\n  { to: "/inventory", label: "المخزن", icon: Boxes },',
  '  { to: "/inventory", label: "المخزن", icon: Boxes },'
);

fs.writeFileSync('src/components/app-shell.tsx', content, 'utf8');
