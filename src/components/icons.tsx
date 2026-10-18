// Deep imports: Metro doesn't tree-shake, and the package root pulls in all ~1,600 Lucide icons.
import type { LucideIcon } from 'lucide-react-native';
import AlertCircle from 'lucide-react-native/icons/circle-alert';
import BarChart3 from 'lucide-react-native/icons/chart-column';
import Calendar from 'lucide-react-native/icons/calendar';
import Camera from 'lucide-react-native/icons/camera';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ClipboardCheck from 'lucide-react-native/icons/clipboard-check';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Copy from 'lucide-react-native/icons/copy';
import Download from 'lucide-react-native/icons/download';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Lock from 'lucide-react-native/icons/lock';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import MapPin from 'lucide-react-native/icons/map-pin';
import Minus from 'lucide-react-native/icons/minus';
import Navigation from 'lucide-react-native/icons/navigation';
import Package from 'lucide-react-native/icons/package';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Search from 'lucide-react-native/icons/search';
import Share2 from 'lucide-react-native/icons/share-2';
import Trash from 'lucide-react-native/icons/trash';
import Truck from 'lucide-react-native/icons/truck';
import User from 'lucide-react-native/icons/user';
import Users from 'lucide-react-native/icons/users';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import X from 'lucide-react-native/icons/x';

/** Every icon the app uses, by short name (Lucide set, as in the design mockups). */
const ICONS = {
  alert: AlertCircle,
  chart: BarChart3,
  calendar: Calendar,
  camera: Camera,
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clipboardCheck: ClipboardCheck,
  clipboardList: ClipboardList,
  copy: Copy,
  download: Download,
  more: Ellipsis,
  eye: Eye,
  eyeOff: EyeOff,
  lock: Lock,
  logOut: LogOut,
  mail: Mail,
  mapPin: MapPin,
  minus: Minus,
  navigation: Navigation,
  box: Package,
  edit: Pencil,
  plus: Plus,
  refresh: RefreshCw,
  search: Search,
  share: Share2,
  trash: Trash,
  truck: Truck,
  user: User,
  users: Users,
  wifiOff: WifiOff,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
