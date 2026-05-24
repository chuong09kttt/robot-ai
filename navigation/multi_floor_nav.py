class MultiFloorNavigator:

    def go_to(self, location):

        if "floor_2" in location:
            print("Going to elevator... switching floor")

        print(f"Navigating to {location}")

        return {
            "status": "moving",
            "destination": location
        }
