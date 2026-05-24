class RobotControl:

    def move(self, action):

        if action == "support_mode":
            print("robot approaches user slowly")

        if action == "follow":
            print("robot following user")

        if action == "stop":
            print("robot stopping")
