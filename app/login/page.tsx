import { redirect } from 'next/navigation';
export default function LoginRoute() { redirect('/?auth=signin'); }
