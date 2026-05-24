class HotelMapManager:

    def __init__(self):
        self.floors = {
            "1": ["reception", "lobby", "room_101"],
            "2": ["room_201", "room_202", "hall"]
        }

    def get_route(self, start, target):

        return {
            "path": [start, "elevator", target],
            "floor_switch": True if "2" in target else False
        }
