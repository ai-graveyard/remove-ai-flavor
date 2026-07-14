"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useTranslations, useLocale } from 'next-intl'

import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import LangSwitchButton from '@/components/common/language-switch-button'
import ThemeToggleButton from '@/components/common/theme-toggle-button'
import { Link, useRouter } from '@/i18n/navigation'
import { cn } from "@/lib/utils"
import { fetcher } from '@/util/fetcher'
import { clearGuestUsage } from '@/util/guest-usage'
import { canEnterGuestMode, type AuthMode } from '@/util/login-page'
import { clearAuthData } from '@/util/token'

type AuthenticatedUserType = 'admin' | 'user'

/** 登录接口签发的访问令牌与刷新令牌。 */
interface AuthTokenResponse {
  access_token: string
  refresh_token: string
}

/** 登录完成后用于确认跳转目标的用户资料。 */
interface AuthUserProfile {
  user_type: AuthenticatedUserType
}

/**
 * 登录页面组件，处理验证码、密码、注册和密码重置流程。
 */
export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const lang = useLocale();
  
  // State for current auth mode
  const [mode, setMode] = useState<AuthMode>('code-login');
  
  // Common form states
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  // Registration states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // Reset password states
  const [newPassword, setNewPassword] = useState("");
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Validation error states
  const [emailError, setEmailError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [codeError, setCodeError] = useState("");

  // State for random illustration
  const [randomIllustration, setRandomIllustration] = useState<string>('');

  // Select a random illustration on component mount (client-side)
  useEffect(() => {
    const illustrations = [
      '/login_images/undraw_coffee-with-friends_ocg2.svg',
      '/login_images/undraw_shared-workspace_6y9d.svg',
      '/login_images/undraw_work-from-anywhere_tpk5.svg',
      '/login_images/undraw_working-from-anywhere_33m9.svg',
      '/login_images/undraw_team-collaboration_phnf.svg'
    ];
    const randomIndex = Math.floor(Math.random() * illustrations.length);
    setRandomIllustration(illustrations[randomIndex]);
  }, []);

  /**
   * 处理登录成功后的页面跳转
   * 
   * @param userType - 用户类型 ('admin' 或 'user')
   */
  const handleLoginRedirect = (userType: AuthenticatedUserType) => {
    // 登录或注册成功后清除浏览器中的访客身份与次数。
    clearGuestUsage();

    // 先发起目标页导航，避免全局数据刷新阻塞或覆盖本次登录跳转。
    router.replace(userType === 'admin' ? '/admin' : '/');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('user-logged-in'));
    }, 0);
  };

  /**
   * 保存新签发的令牌并向服务端确认用户身份。
   *
   * 登录阶段的 401 由当前表单处理，不能触发全局登出跳转；资料确认失败时
   * 会清除刚写入的令牌，避免以不完整登录态进入首页或管理后台。
   *
   * @param userData - 登录、注册或验证码接口返回的令牌数据。
   * @param invalidResponseMessage - 令牌响应不完整时显示的本地化错误。
   * @returns 服务端确认后的用户类型。
   */
  const completeAuthentication = async (
    userData: unknown,
    invalidResponseMessage: string,
  ): Promise<AuthenticatedUserType> => {
    if (!userData || typeof userData !== 'object') {
      throw new Error(invalidResponseMessage)
    }

    const { access_token, refresh_token } = userData as Partial<AuthTokenResponse>
    if (!access_token || !refresh_token) {
      throw new Error(invalidResponseMessage)
    }

    localStorage.setItem('email', email)
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)

    try {
      const userProfile = await fetcher<AuthUserProfile>('/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`,
        },
        redirectOnUnauthorized: false,
      })

      if (!userProfile) {
        throw new Error(invalidResponseMessage)
      }

      const actualUserType = userProfile.user_type === 'admin' ? 'admin' : 'user'
      localStorage.setItem('user_type', actualUserType)
      window.dispatchEvent(new CustomEvent('user-type-changed'))
      return actualUserType
    } catch (error) {
      clearAuthData()
      throw error
    }
  }

  // validate email format
  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // validate verification code
  function isValidCode(code: string) {
    return code.trim().length === 6;
  }

  // validate username
  function isValidUsername(username: string) {
    if (!username || username.length < 4 || username.length > 12) {
      return false;
    }
    return /^[a-zA-Z0-9_]+$/.test(username);
  }

  // validate password
  function isValidPassword(password: string) {
    return password && password.length >= 6;
  }

  // Handle email blur validation
  const handleEmailBlur = () => {
    if (email.trim() && !isValidEmail(email)) {
      setEmailError(t('common.validation.emailFormat'));
    } else {
      setEmailError("");
    }
  };

  // Handle username blur validation
  const handleUsernameBlur = () => {
    if (username.trim() && !isValidUsername(username)) {
      if (username.length < 4 || username.length > 12) {
        setUsernameError(t('common.validation.usernameLength'));
      } else {
        setUsernameError(t('common.validation.usernameFormat'));
      }
    } else {
      setUsernameError("");
    }
  };

  // Handle password blur validation
  const handlePasswordBlur = () => {
    if (password.trim() && !isValidPassword(password)) {
      setPasswordError(t('common.validation.passwordLength'));
    } else {
      setPasswordError("");
    }
  };

  // Handle new password blur validation
  const handleNewPasswordBlur = () => {
    if (newPassword.trim() && !isValidPassword(newPassword)) {
      setNewPasswordError(t('common.validation.passwordLength'));
    } else {
      setNewPasswordError("");
    }
  };

  // Handle verification code blur validation
  const handleCodeBlur = () => {
    if (code.trim() && !isValidCode(code)) {
      setCodeError(t('common.validation.codeLength'));
    } else {
      setCodeError("");
    }
  };

  // Send verification code
  const sendCode = async () => {
    setSending(true);
    try {
      // Determine the purpose of the verification code
      let purpose = 'login';
      if (mode === 'register') {
        purpose = 'register';
      } else if (mode === 'reset-password') {
        purpose = 'reset';
      }
      
      await fetcher('/auth/send_code', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang, purpose }),
        redirectOnUnauthorized: false,
      }).then(() => {
        let message = '';
        switch (purpose) {
          case 'register':
            message = t('auth.verification.codeForRegister');
            break;
          case 'reset':
            message = t('auth.verification.codeForReset');
            break;
          default:
            message = t('auth.messages.codeSent');
        }
        
        toast.success(message);
        setCountdown(60);
      }).catch(err => {
        toast.error(err.message || t('auth.messages.loginFailed'));
      });
    } catch {
      toast.error(t('common.messages.networkError'));
    }
    setSending(false);
  };

  // Countdown side effect
  useEffect(() => {
    if (countdown === 0) return;
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [countdown]);

  // 处理用户注册
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      const userData = await fetcher('/auth/register', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          code, 
          username, 
          password,
          lang 
        }),
        redirectOnUnauthorized: false,
      });

      const actualUserType = await completeAuthentication(
        userData,
        t('auth.messages.registerFailed'),
      )
      toast.success(t('auth.messages.registerSuccess'))
      handleLoginRedirect(actualUserType)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('auth.messages.registerFailed');
      toast.error(errorMessage);
    }
    setLoading(false);
  };

  // 处理密码登录
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const userData = await fetcher('/auth/login', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, lang }),
        redirectOnUnauthorized: false,
      });

      const actualUserType = await completeAuthentication(
        userData,
        t('auth.messages.loginFailed'),
      )
      toast.success(t('auth.messages.loginSuccess'))
      handleLoginRedirect(actualUserType)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('auth.messages.loginFailed');
      toast.error(errorMessage);
    }
    setLoading(false);
  };

  // 处理密码重置
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await fetcher('/auth/reset_password', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          code, 
          new_password: newPassword,
          lang 
        }),
        redirectOnUnauthorized: false,
      });

      toast.success(t('auth.messages.resetSuccess'));
      setTimeout(() => {
        setMode('password-login');
        setCode('');
        setNewPassword('');
      }, 1000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('auth.messages.resetFailed');
      toast.error(errorMessage);
    }
    setLoading(false);
  };

  // Login with verification code (only for existing users)
  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 先使用统一用户入口登录，再兼容旧的管理员专用入口。
      let userData = null;
      
      try {
        userData = await fetcher('/auth/verify', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code, lang }),
          redirectOnUnauthorized: false,
        });
      } catch (regularError) {
        // 统一入口失败时尝试管理员专用入口，且不允许全局 401 逻辑打断表单。
        try {
          userData = await fetcher('/auth/admin/verify', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code, lang }),
            redirectOnUnauthorized: false,
          });
        } catch {
          throw regularError; // 两个入口均失败时展示首次请求返回的原始错误。
        }
      }

      const actualUserType = await completeAuthentication(
        userData,
        t('auth.messages.loginFailed'),
      )
      if (actualUserType === 'admin') {
        toast.success(t('auth.messages.adminLoginSuccess'))
      } else {
        toast.success(t('auth.messages.userLoginSuccess'))
      }
      handleLoginRedirect(actualUserType)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('auth.messages.loginFailed');
      toast.error(errorMessage);
    }

    setLoading(false);
  };

  // Get form title based on mode
  const getTitle = () => {
    switch (mode) {
      case 'register': return t('pages.login.register');
      case 'reset-password': return t('pages.login.resetPassword');
      case 'password-login': return t('pages.login.passwordLogin');
      default: return t('pages.login.login');
    }
  };

  // Get form description based on mode
  const getDescription = () => {
    switch (mode) {
      case 'register': return t('pages.login.registerFormDescription');
      case 'reset-password': return t('pages.login.resetFormDescription');
      default: return t('pages.login.formDescription');
    }
  };

  // Get submit handler based on mode
  const getSubmitHandler = () => {
    switch (mode) {
      case 'register': return handleRegister;
      case 'reset-password': return handleResetPassword;
      case 'password-login': return handlePasswordLogin;
      default: return handleCodeLogin;
    }
  };

  // Check if form is valid based on mode
  const isFormValid = () => {
    const emailValid = isValidEmail(email);
    
    switch (mode) {
      case 'register':
        return emailValid && 
               isValidCode(code) && 
               isValidUsername(username) && 
               isValidPassword(password);
      case 'reset-password':
        return emailValid && isValidCode(code) && isValidPassword(newPassword);
      case 'password-login':
        return emailValid && isValidPassword(password);
      default:
        return emailValid && isValidCode(code);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Main login card with two columns */}
      <div className="w-full max-w-4xl bg-white dark:bg-black/80 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden relative">
        {/* Language switch and theme toggle buttons positioned at top right of card */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <ThemeToggleButton />
          <LangSwitchButton />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[600px]">
          {/* Left side - Illustration and Logo */}
          <div className="relative hidden lg:flex flex-col items-center justify-center gap-10 p-8 bg-gray-50 dark:bg-gray-900">
            {/* Logo and Slogan */}
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Image
                  src="/logo.svg"
                  alt="Logo"
                  width={100}
                  height={100}
                  className="drop-shadow-lg"
                />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  {t('app.fullName')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {t('app.slogan')}
                </p>
              </div>
            </div>

            {/* Illustration */}
            <div className="flex justify-center">
              {randomIllustration && (
                <Image
                  src={randomIllustration}
                  alt="Work from anywhere illustration"
                  width={340}
                  height={340}
                  priority
                />
              )}
            </div>
          </div>
          
          {/* Right side - Auth form */}
          <div className="flex items-center justify-center p-8 lg:p-12">
            <form
              onSubmit={getSubmitHandler()}
              className={cn("flex flex-col gap-6 w-full max-w-sm")}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-3xl font-bold">{getTitle()}</h1>
                <p className="text-muted-foreground text-sm text-balance">
                  {getDescription()}
                </p>
              </div>
              
              <div className="grid gap-6">
                {/* Email field */}
                <div className="grid gap-3">
                  <Label htmlFor="email">{t('auth.fields.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.placeholders.enterEmail')}
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    onBlur={handleEmailBlur}
                    maxLength={40}
                    required
                    autoFocus
                    className={`h-11 ${emailError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  />
                  {emailError && (
                    <p className="text-sm text-red-500">{emailError}</p>
                  )}
                </div>

                {/* Username field (only for register) */}
                {mode === 'register' && (
                  <div className="grid gap-3">
                    <Label htmlFor="username">{t('auth.fields.username')}</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder={t('common.placeholders.username')}
                      value={username}
                      onChange={e => {
                        setUsername(e.target.value);
                        if (usernameError) setUsernameError("");
                      }}
                      onBlur={handleUsernameBlur}
                      maxLength={12}
                      required
                      className={`h-11 ${usernameError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {usernameError ? (
                      <p className="text-sm text-red-500">{usernameError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t('common.validation.usernameLength')}
                      </p>
                    )}
                  </div>
                )}

                {/* Password field (for password login and register) */}
                {(mode === 'password-login' || mode === 'register') && (
                  <div className="grid gap-3">
                    <Label htmlFor="password">{t('auth.fields.password')}</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t('auth.placeholders.enterPassword')}
                        value={password}
                        onChange={e => {
                          setPassword(e.target.value);
                          if (passwordError) setPasswordError("");
                        }}
                        onBlur={handlePasswordBlur}
                        required
                        className={`h-11 pr-10 ${passwordError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-11 px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {passwordError && (
                      <p className="text-sm text-red-500">{passwordError}</p>
                    )}
                  </div>
                )}

                {/* New password field (only for reset password) */}
                {mode === 'reset-password' && (
                  <div className="grid gap-3">
                    <Label htmlFor="newPassword">{t('auth.fields.newPassword')}</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder={t('auth.placeholders.enterNewPassword')}
                        value={newPassword}
                        onChange={e => {
                          setNewPassword(e.target.value);
                          if (newPasswordError) setNewPasswordError("");
                        }}
                        onBlur={handleNewPasswordBlur}
                        required
                        className={`h-11 pr-10 ${newPasswordError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-11 px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {newPasswordError && (
                      <p className="text-sm text-red-500">{newPasswordError}</p>
                    )}
                  </div>
                )}

                {/* Verification code field (for code login, register, and reset password) */}
                {(mode === 'code-login' || mode === 'register' || mode === 'reset-password') && (
                  <div className="grid gap-3">
                    <Label htmlFor="code">{t('auth.fields.code')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="code"
                        type="text"
                        placeholder={t('auth.placeholders.enterCode')}
                        value={code}
                        onChange={e => {
                          setCode(e.target.value);
                          if (codeError) setCodeError("");
                        }}
                        onBlur={handleCodeBlur}
                        maxLength={6}
                        required
                        className={`flex-1 h-11 ${codeError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      />
                      <Button
                        type="button"
                        onClick={sendCode}
                        disabled={sending || !email || !isValidEmail(email) || countdown > 0}
                        variant="outline"
                        className="whitespace-nowrap h-11 px-4"
                      >
                        {sending
                          ? t('auth.actions.sending')
                          : countdown > 0
                            ? `${t('auth.actions.sendCode')} (${countdown})`
                            : t('auth.actions.sendCode')}
                      </Button>
                    </div>
                    {codeError && (
                      <p className="text-sm text-red-500">{codeError}</p>
                    )}
                  </div>
                )}
                
                {/* Submit button */}
                <Button 
                  type="submit" 
                  className="w-full h-11" 
                  disabled={loading || !isFormValid()}
                >
                  {loading ? (
                    mode === 'register' ? t('auth.actions.registering') :
                    mode === 'reset-password' ? t('auth.actions.resettingPassword') :
                    t('auth.actions.loggingIn')
                  ) : (
                    mode === 'register' ? t('pages.login.registerButton') :
                    mode === 'reset-password' ? t('pages.login.resetPasswordButton') :
                    t('pages.login.loginButton')
                  )}
                </Button>

                {/* 游客入口只在登录流程显示，并保留浏览器中已有的游客用量。 */}
                {canEnterGuestMode(mode) && (
                  <Button asChild variant="outline" className="w-full h-11">
                    <Link href="/">{t('pages.login.exploreAsGuest')}</Link>
                  </Button>
                )}

                {/* Mode switcher links */}
                <div className="flex flex-col gap-2 text-center text-sm">
                  {mode === 'code-login' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setMode('password-login')}
                        className="text-primary hover:underline"
                      >
                        {t('pages.login.loginWithPassword')}
                      </button>
                      <div className="flex justify-center gap-1">
                        <span className="text-muted-foreground">{t('pages.login.dontHaveAccount')}</span>
                        <button
                          type="button"
                          onClick={() => setMode('register')}
                          className="text-primary hover:underline"
                        >
                          {t('pages.login.registerNow')}
                        </button>
                      </div>
                    </>
                  )}

                  {mode === 'password-login' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setMode('code-login')}
                        className="text-primary hover:underline"
                      >
                        {t('pages.login.loginWithCode')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('reset-password')}
                        className="text-primary hover:underline"
                      >
                        {t('pages.login.forgotPassword')}
                      </button>
                      <div className="flex justify-center gap-1">
                        <span className="text-muted-foreground">{t('pages.login.dontHaveAccount')}</span>
                        <button
                          type="button"
                          onClick={() => setMode('register')}
                          className="text-primary hover:underline"
                        >
                          {t('pages.login.registerNow')}
                        </button>
                      </div>
                    </>
                  )}

                  {mode === 'register' && (
                    <div className="flex justify-center gap-1">
                      <span className="text-muted-foreground">{t('pages.login.alreadyHaveAccount')}</span>
                      <button
                        type="button"
                        onClick={() => setMode('code-login')}
                        className="text-primary hover:underline"
                      >
                        {t('pages.login.backToLogin')}
                      </button>
                    </div>
                  )}

                  {mode === 'reset-password' && (
                    <button
                      type="button"
                      onClick={() => setMode('password-login')}
                      className="text-primary hover:underline"
                    >
                      {t('pages.login.backToLoginFromReset')}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {/* Source attribution */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 text-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('app.poweredBy')}</span>
          <a 
            href="https://github.com/open-v2ai/remove-ai-flavor" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-medium hover:text-foreground transition-colors hover:underline"
          >
            {t('app.name')}
          </a>
        </div>
      </div>
    </div>
  );
}