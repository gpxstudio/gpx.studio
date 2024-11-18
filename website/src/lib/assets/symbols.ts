import { Landmark, Icon, Shell, Bike, Building, Tent, Car, Wrench, ShoppingBasket, Droplet, DoorOpen, Trees, Fuel, Home, Info, TreeDeciduous, CircleParking, Cross, Utensils, Construction, BrickWall, ShowerHead, Mountain, Phone, TrainFront, Bed, Binoculars, TriangleAlert, Anchor, Toilet } from "lucide-svelte";
import { Landmark as LandmarkSvg, Shell as ShellSvg, Bike as BikeSvg, Building as BuildingSvg, Tent as TentSvg, Car as CarSvg, Wrench as WrenchSvg, ShoppingBasket as ShoppingBasketSvg, Droplet as DropletSvg, DoorOpen as DoorOpenSvg, Trees as TreesSvg, Fuel as FuelSvg, Home as HomeSvg, Info as InfoSvg, TreeDeciduous as TreeDeciduousSvg, CircleParking as CircleParkingSvg, Cross as CrossSvg, Utensils as UtensilsSvg, Construction as ConstructionSvg, BrickWall as BrickWallSvg, ShowerHead as ShowerHeadSvg, Mountain as MountainSvg, Phone as PhoneSvg, TrainFront as TrainFrontSvg, Bed as BedSvg, Binoculars as BinocularsSvg, TriangleAlert as TriangleAlertSvg, Anchor as AnchorSvg, Toilet as ToiletSvg } from "lucide-static";
import type { ComponentType } from "svelte";

export type Symbol = {
    value: string;
    icon?: ComponentType<Icon>;
    iconSvg?: string;
};

export const symbols: { [key: string]: Symbol } = {
    alert: { value: 'Alert', icon: TriangleAlert, iconSvg: TriangleAlertSvg },
    anchor: { value: 'Anchor', icon: Anchor, iconSvg: AnchorSvg },
    bank: { value: 'Bank', icon: Landmark, iconSvg: LandmarkSvg },
    beach: { value: 'Beach', icon: Shell, iconSvg: ShellSvg },
    bike_trail: { value: 'Bike Trail', icon: Bike, iconSvg: BikeSvg },
    binoculars: { value: 'Binoculars', icon: Binoculars, iconSvg: BinocularsSvg },
    bridge: { value: 'Bridge' },
    building: { value: 'Building', icon: Building, iconSvg: BuildingSvg },
    campground: { value: 'Campground', icon: Tent, iconSvg: TentSvg },
    car: { value: 'Car', icon: Car, iconSvg: CarSvg },
    car_repair: { value: 'Car Repair', icon: Wrench, iconSvg: WrenchSvg },
    convenience_store: { value: 'Convenience Store', icon: ShoppingBasket, iconSvg: ShoppingBasketSvg },
    crossing: { value: 'Crossing' },
    department_store: { value: 'Department Store', icon: ShoppingBasket, iconSvg: ShoppingBasketSvg },
    drinking_water: { value: 'Drinking Water', icon: Droplet, iconSvg: DropletSvg },
    exit: { value: 'Exit', icon: DoorOpen, iconSvg: DoorOpenSvg },
    lodge: { value: 'Lodge', icon: Home, iconSvg: HomeSvg },
    lodging: { value: 'Lodging', icon: Bed, iconSvg: BedSvg },
    forest: { value: 'Forest', icon: Trees, iconSvg: TreesSvg },
    gas_station: { value: 'Gas Station', icon: Fuel, iconSvg: FuelSvg },
    ground_transportation: { value: 'Ground Transportation', icon: TrainFront, iconSvg: TrainFrontSvg },
    hotel: { value: 'Hotel', icon: Bed, iconSvg: BedSvg },
    house: { value: 'House', icon: Home, iconSvg: HomeSvg },
    information: { value: 'Information', icon: Info, iconSvg: InfoSvg },
    park: { value: 'Park', icon: TreeDeciduous, iconSvg: TreeDeciduousSvg },
    parking_area: { value: 'Parking Area', icon: CircleParking, iconSvg: CircleParkingSvg },
    pharmacy: { value: 'Pharmacy', icon: Cross, iconSvg: CrossSvg },
    picnic_area: { value: 'Picnic Area', icon: Utensils, iconSvg: UtensilsSvg },
    restaurant: { value: 'Restaurant', icon: Utensils, iconSvg: UtensilsSvg },
    restricted_area: { value: 'Restricted Area', icon: Construction, iconSvg: ConstructionSvg },
    restroom: { value: 'Restroom', icon: Toilet, iconSvg: ToiletSvg },
    road: { value: 'Road', icon: BrickWall, iconSvg: BrickWallSvg },
    scenic_area: { value: 'Scenic Area', icon: Binoculars, iconSvg: BinocularsSvg },
    shelter: { value: 'Shelter', icon: Tent, iconSvg: TentSvg },
    shopping_center: { value: 'Shopping Center', icon: ShoppingBasket },
    shower: { value: 'Shower', icon: ShowerHead, iconSvg: ShowerHeadSvg },
    summit: { value: 'Summit', icon: Mountain, iconSvg: MountainSvg },
    telephone: { value: 'Telephone', icon: Phone, iconSvg: PhoneSvg },
    tunnel: { value: 'Tunnel' },
    water_source: { value: 'Water Source', icon: Droplet, iconSvg: DropletSvg },
};

export function getSymbolKey(value: string | undefined): string | undefined {
    if (value === undefined) {
        return undefined;
    } else {
        return Object.keys(symbols).find(key => symbols[key].value === value);
    }
}