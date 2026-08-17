import { redirect } from 'next/navigation'
import StagingLoginForm from './StagingLoginForm'

export default function LoginPage() {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'staging') {
    return <StagingLoginForm />
  }
  redirect('https://www.klia.com.ar/login')
}
