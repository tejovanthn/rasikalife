import * as SheetPrimitive from '@radix-ui/react-dialog';
import {
  Activity,
  Calendar,
  ChevronDown,
  ClipboardList,
  FileImage,
  ListChecks,
  LogOut,
  Menu,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import { useContext, useEffect, useRef, useState } from 'react';
import { Form, Link, NavLink } from 'react-router';
import { useAuth } from '~/components/auth-context';
import { ScriptContext } from '~/components/script-context';
import { ThemeContext } from '~/components/theme-context';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';
import type { DisplayScript } from '~/sessions.server';

import { GlobalSearch } from './GlobalSearch';
import { ModeToggle } from './mode-toggle';
import { ScriptSelector } from './script-selector';

const SCRIPT_OPTIONS: { value: DisplayScript; label: string }[] = [
  { value: 'iast', label: 'IAST' },
  { value: 'devanagari', label: 'देवनागरी' },
  { value: 'tamil', label: 'தமிழ்' },
  { value: 'telugu', label: 'తెలుగు' },
  { value: 'kannada', label: 'ಕನ್ನಡ' },
];

const NAV_LINKS = [
  { href: '/carnatic/compositions', label: 'Compositions' },
  { href: '/artists', label: 'Artists' },
  { href: '/carnatic/ragas', label: 'Ragas' },
];

const EVENT_LINKS = [
  { href: '/events', label: 'Events' },
  { href: '/festivals', label: 'Festivals' },
  { href: '/venues', label: 'Venues' },
  { href: '/organisers', label: 'Organisers' },
];

export const Header = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const { user } = useAuth();
  const { script, setScript } = useContext(ScriptContext);
  const { theme, setTheme } = useContext(ThemeContext);

  useEffect(() => {
    if (isSidebarOpen && mobileNavRef.current) {
      // Focus the first link when menu opens
      const firstLink = mobileNavRef.current.querySelector('a');
      if (firstLink) {
        firstLink.focus();
      }
    }
  }, [isSidebarOpen]);

  return (
    <nav className="shadow-lg sticky top-0 z-50 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/">
                <img
                  className="h-8 w-8"
                  src="/android-chrome-192x192.png"
                  alt="Rasika.life - Indian Classical Music Database"
                  width={32}
                  height={32}
                  decoding="async"
                />
              </Link>
            </div>
            <div className="hidden md:block">
              <nav className="ml-10 flex items-baseline space-x-1" aria-label="Main navigation">
                {NAV_LINKS.map(link => (
                  <NavLink
                    key={link.label}
                    to={link.href}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
                <DropdownMenu>
                  <DropdownMenuTrigger className="px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 text-muted-foreground hover:text-foreground flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    Events
                    <ChevronDown className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {EVENT_LINKS.map(link => (
                      <DropdownMenuItem key={link.href} asChild>
                        <Link to={link.href}>{link.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </nav>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <GlobalSearch />
            <ScriptSelector />
            <ModeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2">
                    {user.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name}
                        className="h-8 w-8 rounded-full"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                    <span className="hidden lg:inline text-sm font-medium">
                      {user.name.split(' ')[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/my-edits" className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      My Edits
                    </Link>
                  </DropdownMenuItem>
                  {(user.role === 'moderator' || user.role === 'admin') && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/moderator/edits" className="flex items-center gap-2">
                          <ListChecks className="h-4 w-4" />
                          Edit Queue
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/moderator/events" className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Event Queue
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/moderator/draft-events" className="flex items-center gap-2">
                          <FileImage className="h-4 w-4" />
                          Draft Posters
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/moderator/enrich" className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Daily Enrichment
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/moderator/crawl-status" className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Crawl Status
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  {user.role === 'admin' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/users" className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Manage Users
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/moderator/crawl-status" className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Crawl Status
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Form method="post" action="/auth/logout" className="w-full">
                      <Button type="submit" variant="outline" className="w-full justify-start">
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </Button>
                    </Form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/auth/login">Login</Link>
              </Button>
            )}
          </div>
          <div className="md:hidden flex items-center space-x-2">
            <GlobalSearch />
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11">
                  {isSidebarOpen ? (
                    <>
                      <X className="h-6 w-6" />
                      <span className="sr-only">Close menu</span>
                    </>
                  ) : (
                    <>
                      <Menu className="h-6 w-6" />
                      <span className="sr-only">Open menu</span>
                    </>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] sm:w-[300px] flex flex-col">
                <SheetHeader>
                  <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                  <SheetDescription className="sr-only">
                    Main navigation menu for Rasika.life
                  </SheetDescription>
                </SheetHeader>
                <nav
                  ref={mobileNavRef}
                  className="flex flex-col space-y-4 mt-4 overflow-y-auto flex-1"
                  aria-label="Main navigation"
                >
                  {NAV_LINKS.map(link => (
                    <NavLink
                      key={link.label}
                      to={link.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-md text-base font-medium transition-colors duration-150 ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  ))}
                  <div className="border-t border-border pt-2">
                    <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Events
                    </p>
                    {EVENT_LINKS.map(link => (
                      <NavLink
                        key={link.href}
                        to={link.href}
                        onClick={() => setIsSidebarOpen(false)}
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-md text-base font-medium transition-colors duration-150 ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`
                        }
                      >
                        {link.label}
                      </NavLink>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-border mt-4 space-y-4">
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Script
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {SCRIPT_OPTIONS.map(option => (
                          <Button
                            key={option.value}
                            variant={script === option.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setScript(option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Theme
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant={theme === 'light' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTheme('light')}
                        >
                          Light
                        </Button>
                        <Button
                          variant={theme === 'dark' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTheme('dark')}
                        >
                          Dark
                        </Button>
                      </div>
                    </div>
                    {user ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3">
                          {user.picture ? (
                            <img
                              src={user.picture}
                              alt={user.name}
                              className="h-8 w-8 rounded-full"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <User className="h-8 w-8 rounded-full bg-muted p-1" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                        <Link
                          to="/my-edits"
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                          onClick={() => setIsSidebarOpen(false)}
                        >
                          <ClipboardList className="h-4 w-4" />
                          My Edits
                        </Link>
                        {(user.role === 'moderator' || user.role === 'admin') && (
                          <>
                            <Link
                              to="/moderator/edits"
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                              onClick={() => setIsSidebarOpen(false)}
                            >
                              <ListChecks className="h-4 w-4" />
                              Edit Queue
                            </Link>
                            <Link
                              to="/moderator/events"
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                              onClick={() => setIsSidebarOpen(false)}
                            >
                              <Calendar className="h-4 w-4" />
                              Event Queue
                            </Link>
                            <Link
                              to="/moderator/draft-events"
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                              onClick={() => setIsSidebarOpen(false)}
                            >
                              <FileImage className="h-4 w-4" />
                              Draft Posters
                            </Link>
                            <Link
                              to="/moderator/enrich"
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                              onClick={() => setIsSidebarOpen(false)}
                            >
                              <Sparkles className="h-4 w-4" />
                              Daily Enrichment
                            </Link>
                            <Link
                              to="/moderator/crawl-status"
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                              onClick={() => setIsSidebarOpen(false)}
                            >
                              <Activity className="h-4 w-4" />
                              Crawl Status
                            </Link>
                          </>
                        )}
                        {user.role === 'admin' && (
                          <>
                            <Link
                              to="/admin/users"
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                              onClick={() => setIsSidebarOpen(false)}
                            >
                              <Users className="h-4 w-4" />
                              Manage Users
                            </Link>
                            <Link
                              to="/moderator/crawl-status"
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                              onClick={() => setIsSidebarOpen(false)}
                            >
                              <Activity className="h-4 w-4" />
                              Crawl Status
                            </Link>
                          </>
                        )}
                        <Form method="post" action="/auth/logout">
                          <Button
                            type="submit"
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => setIsSidebarOpen(false)}
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            Logout
                          </Button>
                        </Form>
                      </div>
                    ) : (
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/auth/login" onClick={() => setIsSidebarOpen(false)}>
                          Login with Google
                        </Link>
                      </Button>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
